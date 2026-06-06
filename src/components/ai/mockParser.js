import { format, addDays, addWeeks, addMonths, parse, parseISO, isValid, isBefore, startOfDay } from 'date-fns'

const WEEKDAYS = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

const MODEL_CANDIDATES = [
  "gemini-3.1-flash-live-preview", // Gemini 3 Flash Live Preview.
  "gemini-3-flash-preview", // Основная Gemini 3 Flash модель для generateContent.
  "gemini-2.5-flash",       // Фолбэк.
  "gemini-2.5-flash-lite",  // Резервный фолбэк.
]

const VALID_RECURRENCES = new Set(['daily', 'weekly', 'monthly', 'yearly'])
const REMINDER_TOKEN_MAP = {
  at_start: 'start',
  start: 'start',
  '10_min': 'before10',
  before10: 'before10',
  '1_hour': 'before60',
  before60: 'before60',
  '1_day': 'before1day',
  before1day: 'before1day',
  '2_days': 'before2days',
  before2days: 'before2days',
  '1_week': 'before1week',
  before1week: 'before1week',
  '1_month': 'before1month',
  before1month: 'before1month',
  when_finished: 'finish',
  finish: 'finish',
}

function customReminderId(minutes) {
  const safeMinutes = Math.max(1, Math.min(10_080, Math.round(Number(minutes) || 1)))
  return `custom:${safeMinutes}`
}

/**
 * Helper to execute standard API call for a specific Gemini model candidate.
 */
async function fetchGeminiData(modelName, apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  const response = await fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    })
  }).finally(() => clearTimeout(timeoutId))

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text
  
  if (!responseText) {
    throw new Error('Empty response payload')
  }

  return JSON.parse(responseText.trim())
}

/**
 * Parses user input using either the Gemini API (trying candidate models sequentially)
 * or a local RegEx fallback (if no key is found or all API calls fail).
 * 
 * Returns resolved date in YYYY-MM-DD format.
 */
export async function parseTaskInput(input) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY
  const isConfigured = apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE' && apiKey.trim() !== ''
  const todayISO = format(new Date(), 'yyyy-MM-dd')

  if (!isConfigured) {
    console.warn('Gemini API key is not configured. Falling back to local Regex parser.')
    return getResolvedFallback(input)
  }

  const todayName = format(new Date(), 'EEEE, MMMM d, yyyy')
  const prompt = `You are an advanced NLP engine for a smart calendar and task manager app. Parse the user's natural language input into one strict JSON object that matches the app's supported fields.
User input: "${input}"
Current date/time context: ${new Date().toISOString()} (today is: ${todayName})

Rules:
1. intent must be "schedule" for calendar entries and "inbox" for loose to-do items.
2. Use "schedule" when the user gives a date, a specific time, a recurring item, reminders, or an important calendar-like event. Use "inbox" only for chores or thoughts with no date, time, recurrence, or reminders.
3. title should be clean and short for the UI. Remove date, time, duration, reminder, and recurrence wording. If the user writes in Russian, keep the title in Russian.
4. date must be "YYYY-MM-DD". Resolve relative dates from today's date (${todayName}). If there is no date, use "${todayISO}" for schedule entries.
5. time must be "HH:MM" in 24-hour format or null. If an entry belongs on the calendar but no exact time is given, set time to null; the app will use its default time.
6. duration is minutes. Default to 30 for schedule entries when unspecified. Use null for inbox entries.
7. repeat_frequency must be one of "daily", "weekly", "monthly", "yearly", or "none".
8. notification_moments must contain only these app tokens: "start", "before10", "before60", "before1day", "before2days", "before1week", "before1month", "finish", or custom minute tokens like "custom:45".
9. Birthdays and anniversaries: title format "Birthday: [Name]" or "Anniversary: [Name]", intent "schedule", repeat_frequency "yearly", reminders ["before1week", "before1day", "start"].
10. Critical events such as flight, doctor, dentist, exam, interview, or show should include reminders ["before1day", "before60"] unless the user gives different reminders.
11. Return only raw JSON. No markdown, no explanation.

Respond ONLY with a raw JSON object matching this schema:
{
  "intent": "schedule" | "inbox",
  "title": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" | null,
  "duration": number | null,
  "repeat_frequency": "daily" | "weekly" | "monthly" | "yearly" | "none",
  "notification_moments": []
}`

  // Try each model candidate sequentially
  for (const model of MODEL_CANDIDATES) {
    try {
      console.log(`Attempting task parsing using Gemini model: ${model}`)
      const parsed = await fetchGeminiData(model, apiKey, prompt)
      return normalizeParsedResult(parsed, input)
    } catch (error) {
      console.error(`Gemini candidate model ${model} failed:`, error.message)
      // Continue loop to try next fallback model candidate
    }
  }

  console.warn('All Gemini candidate models failed to parse request. Falling back to local Regex parser.')
  return getResolvedFallback(input)
}

function getResolvedFallback(input) {
  return localRegexParse(input)
}

function normalizeParsedResult(parsed, input) {
  const safeParsed = parsed && typeof parsed === 'object' ? parsed : {}
  const rawIntent = safeParsed.intent
  const time = normalizeParsedTime(safeParsed.time ?? safeParsed.start_time)
  const repeatFrequency = normalizeRepeatFrequency(
    safeParsed.repeat_frequency ?? safeParsed.recurrence,
    safeParsed.is_recurring
  )
  const notificationMoments = normalizeNotificationMoments(
    safeParsed.notification_moments ?? safeParsed.reminders
  )
  const hasCalendarMetadata = repeatFrequency !== 'none' || notificationMoments.length > 0
  const intent = normalizeIntent(rawIntent, { time, hasCalendarMetadata })

  return {
    intent,
    title: normalizeTitle(safeParsed.title),
    date: resolveParsedDate(safeParsed.date ?? safeParsed.start_date, input),
    time: intent === 'schedule' ? time : null,
    duration: intent === 'schedule' ? normalizeDuration(safeParsed.duration) : null,
    repeat_frequency: intent === 'schedule' ? repeatFrequency : 'none',
    notification_moments: intent === 'schedule' ? notificationMoments : [],
    raw: input,
  }
}

function normalizeIntent(intent, { time, hasCalendarMetadata }) {
  if (intent === 'schedule' || intent === 'event') return 'schedule'
  if (intent === 'inbox' || intent === 'task') {
    return time || hasCalendarMetadata ? 'schedule' : 'inbox'
  }
  return time || hasCalendarMetadata ? 'schedule' : 'inbox'
}

function normalizeTitle(title) {
  return typeof title === 'string' && title.trim() ? title.trim() : 'New Task'
}

function normalizeParsedTime(time) {
  return typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null
}

function normalizeDuration(duration) {
  const value = Number(duration)
  if (!Number.isFinite(value)) return 30
  return Math.min(Math.max(Math.round(value), 1), 24 * 60)
}

function normalizeRepeatFrequency(recurrence, isRecurring) {
  if (typeof recurrence === 'string') {
    const normalized = recurrence.toLowerCase()
    if (VALID_RECURRENCES.has(normalized)) return normalized
  }

  return isRecurring ? 'weekly' : 'none'
}

function normalizeNotificationMoments(reminders) {
  if (!Array.isArray(reminders)) return []

  return reminders.reduce((moments, reminder) => {
    let moment = null
    if (typeof reminder === 'number') {
      moment = customReminderId(reminder)
    } else if (typeof reminder === 'string') {
      const trimmed = reminder.trim()
      moment = REMINDER_TOKEN_MAP[trimmed] || (/^custom:\d+$/.test(trimmed) ? customReminderId(trimmed.replace('custom:', '')) : null)
    }

    if (moment && !moments.includes(moment)) moments.push(moment)
    return moments
  }, [])
}

function resolveParsedDate(dateValue, input) {
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  if (!dateValue) return resolveDateReference(input) || todayISO

  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const parsed = parseISO(dateValue)
    if (isValid(parsed)) return dateValue
  }

  return resolveDateReference(`${dateValue} ${input}`) || todayISO
}

function resolveDateReference(text, baseDate = new Date()) {
  const normalized = text.toLowerCase()
  const base = startOfDay(baseDate)

  if (/\bday after tomorrow\b/.test(normalized)) return format(addDays(base, 2), 'yyyy-MM-dd')
  if (/\btomorrow\b/.test(normalized)) return format(addDays(base, 1), 'yyyy-MM-dd')
  if (/\b(today|tonight)\b/.test(normalized)) return format(base, 'yyyy-MM-dd')

  const relativeMatch = normalized.match(/\bin\s+(\d+)\s+(day|days|week|weeks|month|months)\b/)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1])
    const unit = relativeMatch[2]
    if (unit.startsWith('day')) return format(addDays(base, amount), 'yyyy-MM-dd')
    if (unit.startsWith('week')) return format(addWeeks(base, amount), 'yyyy-MM-dd')
    if (unit.startsWith('month')) return format(addMonths(base, amount), 'yyyy-MM-dd')
  }

  if (/\bnext week\b/.test(normalized)) return format(addWeeks(base, 1), 'yyyy-MM-dd')
  if (/\bnext month\b/.test(normalized)) return format(addMonths(base, 1), 'yyyy-MM-dd')

  const explicitDate = parseExplicitDate(normalized, base)
  if (explicitDate) return explicitDate

  const weekdayMatch = normalized.match(/\b(?:on\s+|this\s+|next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/)
  if (weekdayMatch) {
    const targetDay = WEEKDAYS[weekdayMatch[1]]
    let daysUntil = (targetDay - base.getDay() + 7) % 7
    if (daysUntil === 0 && !/\b(today|this)\b/.test(normalized)) daysUntil = 7
    return format(addDays(base, daysUntil), 'yyyy-MM-dd')
  }

  return null
}

function parseExplicitDate(text, base) {
  const monthDateMatch = text.match(/\b(?:on\s+)?((?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/)
  if (monthDateMatch) {
    const dateText = monthDateMatch[1].replace(/\./g, '').replace(/(\d)(st|nd|rd|th)/, '$1')
    return parseFutureDate(dateText, ['MMMM d yyyy', 'MMM d yyyy', 'MMMM d', 'MMM d'], base)
  }

  const numericDateMatch = text.match(/\b(?:on\s+)?(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/)
  if (numericDateMatch) {
    return parseFutureDate(numericDateMatch[1], ['M/d/yyyy', 'M-d-yyyy', 'M/d/yy', 'M-d-yy', 'M/d', 'M-d'], base)
  }

  return null
}

function parseFutureDate(dateText, formats, base) {
  for (const dateFormat of formats) {
    const parsed = parse(dateText, dateFormat, base)
    if (!isValid(parsed)) continue

    let resolved = startOfDay(parsed)
    if (!dateFormat.includes('y') && isBefore(resolved, base)) {
      resolved = addMonths(resolved, 12)
    }
    return format(resolved, 'yyyy-MM-dd')
  }

  return null
}

function localRegexParse(input) {
  const text = input.toLowerCase().trim()

  // Determine intent: inbox vs schedule
  const isInbox = /\b(inbox|todo|to-do|to do|add to list|put .+ in)\b/i.test(text)
  const intent = isInbox ? 'inbox' : 'schedule'

  // Extract time: "at 3 PM", "at 14:00", "at 3:30pm"
  let time = null
  const timeMatch = text.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2] || '0')
    const period = timeMatch[3]?.toLowerCase()
    if (period === 'pm' && hours < 12) hours += 12
    if (period === 'am' && hours === 12) hours = 0
    time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  // Extract duration: "for 45 minutes", "for 1 hour", "for 1.5 hours"
  let duration = 30 // default 30 minutes
  const durationMatch = text.match(/for\s+(\d+\.?\d*)\s*(min(?:ute)?s?|hours?|hr)/i)
  if (durationMatch) {
    const amount = parseFloat(durationMatch[1])
    const unit = durationMatch[2].toLowerCase()
    if (unit.startsWith('h')) {
      duration = Math.round(amount * 60)
    } else {
      duration = Math.round(amount)
    }
  }

  const date = resolveDateReference(text) || format(new Date(), 'yyyy-MM-dd')

  // Extract title: remove time/date/duration phrases, intent phrases
  let title = text
    .replace(/\b(schedule|put|add|create|set up|set|plan|remind me to|reminder)\b/gi, '')
    .replace(/at\s+\d{1,2}(:\d{2})?\s*(am|pm)?/gi, '')
    .replace(/for\s+\d+\.?\d*\s*(min(?:ute)?s?|hours?|hr)/gi, '')
    .replace(/\b(day after tomorrow|tomorrow|today|tonight|next week|next month)\b/gi, '')
    .replace(/\bin\s+\d+\s+(day|days|week|weeks|month|months)\b/gi, '')
    .replace(/\b(on|this|next)?\s*(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/gi, '')
    .replace(/\b(on\s+)?((jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+\d{1,2}(st|nd|rd|th)?(,?\s+\d{4})?)\b/gi, '')
    .replace(/\b(on\s+)?\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/gi, '')
    .replace(/\b(in my inbox|to my inbox|in inbox|to inbox|in my to-?do|to my list|to list)\b/gi, '')
    .replace(/\b(a|an|the|my)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Capitalize first letter of each word
  title = title.replace(/\b\w/g, c => c.toUpperCase())

  // If title is empty, use a generic one
  if (!title) title = 'New Task'

  return {
    intent,
    title,
    date,
    time: time || (intent === 'schedule' ? '09:00' : null),
    duration: intent === 'schedule' ? duration : null,
    repeat_frequency: 'none',
    notification_moments: [],
    raw: input,
  }
}

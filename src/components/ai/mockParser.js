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
  "gemini-3-flash-preview", // Основная Gemini 3 Flash модель для generateContent.
  "gemini-2.5-flash",       // Фолбэк.
  "gemini-2.5-flash-lite",  // Резервный фолбэк.
]

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
  const prompt = `You are an assistant that extracts tasks from natural language inputs and formats them as JSON.
User input: "${input}"
Current date/time context: ${new Date().toISOString()} (today is: ${todayName})

Extract:
1. intent: "schedule" (if user specifies a time, duration, or calendar scheduling intent) or "inbox" (if user wants to add to list/inbox or has no time details).
2. title: Short, capitalized title for the task (e.g. "Buy Groceries", "Dentist Appointment"). Remove dates/times from the title.
3. date: Determine the target date based on references in the user input relative to today's date (${todayName}). Format it strictly as "YYYY-MM-DD" (e.g., "2026-06-01"). If no date or specific day is mentioned, default to today's date: "${todayISO}".
4. time: Extract the time in 24h format "HH:MM". Set to null if intent is "inbox" or no time is specified.
5. duration: Extract the duration in minutes as a number. Default to 30 if intent is "schedule" and no duration is specified. Set to null if intent is "inbox".

Respond ONLY with a raw JSON object matching this schema:
{
  "intent": "schedule" | "inbox",
  "title": "string",
  "date": "YYYY-MM-DD",
  "time": "HH:MM" | null,
  "duration": number | null
}`

  // Try each model candidate sequentially
  for (const model of MODEL_CANDIDATES) {
    try {
      console.log(`Attempting task parsing using Gemini model: ${model}`)
      const parsed = await fetchGeminiData(model, apiKey, prompt)
      return {
        intent: parsed.intent || 'inbox',
        title: parsed.title || 'New Task',
        date: resolveParsedDate(parsed.date, input),
        time: parsed.time,
        duration: parsed.duration,
        raw: input,
      }
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
    raw: input,
  }
}

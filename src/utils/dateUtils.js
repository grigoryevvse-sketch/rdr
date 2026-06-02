import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isSameMonth,
  parseISO,
  isToday,
  addDays,
  subDays,
} from 'date-fns'

export { isToday, isSameDay, isSameMonth, parseISO, addDays, subDays }

/**
 * Generate an array of hour strings for the timeline: ["00:00", "01:00", ..., "23:00"]
 */
export function generateHourSlots() {
  return Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0')
    return `${h}:00`
  })
}

/**
 * Format "14:30" → "2:30 PM"
 */
export function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
}

/**
 * Given a start time "09:30" and duration in minutes, return the end time string.
 */
export function getEndTime(startTime, durationMinutes) {
  const [h, m] = startTime.split(':').map(Number)
  const totalMinutes = h * 60 + m + durationMinutes
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
}

/**
 * Compute pixel offset for a given time within the timeline.
 * @param {string} time24 - "HH:MM" format
 * @param {number} pixelsPerHour - height of one hour slot
 * @returns {number} pixel offset from top
 */
export function timeToPixels(time24, pixelsPerHour = 80) {
  const [h, m] = time24.split(':').map(Number)
  return (h + m / 60) * pixelsPerHour
}

/**
 * Get today's date formatted nicely.
 */
export function getFormattedToday() {
  return format(new Date(), 'EEEE, MMMM d')
}

/**
 * Format any date nicely (e.g. "Tuesday, June 3")
 */
export function formatSelectedDate(date) {
  return format(date, 'EEEE, MMMM d')
}

/**
 * Get current time as "HH:MM" 24h string.
 */
export function getCurrentTime24() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Generate a simple unique ID.
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/**
 * Get 7 days in the week containing the given date.
 */
export function getWeekDays(date) {
  const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday start
  const end = endOfWeek(date, { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end })
}

/**
 * Get all calendar grid days in the month containing the given date.
 */
export function getMonthGridDays(date) {
  const monthStart = startOfMonth(date)
  const monthEnd = endOfMonth(date)
  
  const start = startOfWeek(monthStart, { weekStartsOn: 1 })
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  return eachDayOfInterval({ start, end })
}

/**
 * Helper to format date object as YYYY-MM-DD
 */
export function formatDateISO(date) {
  return format(date, 'yyyy-MM-dd')
}

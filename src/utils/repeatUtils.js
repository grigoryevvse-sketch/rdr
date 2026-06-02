import { addDays, addMonths, addWeeks, addYears, parseISO } from 'date-fns'
import { formatDateISO } from './dateUtils'

export const REPEAT_FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
]

export function isRepeatingTask(task) {
  return Boolean(task?.repeat_frequency && task.repeat_frequency !== 'none')
}

export function getRepeatLabel(task) {
  if (!isRepeatingTask(task)) return ''
  return REPEAT_FREQUENCIES.find((frequency) => frequency.value === task.repeat_frequency)?.label || 'Repeats'
}

export function getNextRepeatDate(task) {
  if (!isRepeatingTask(task) || !task.date) return null

  const currentDate = parseISO(task.date)
  const interval = Math.max(Number(task.repeat_interval) || 1, 1)

  if (task.repeat_frequency === 'daily') return formatDateISO(addDays(currentDate, interval))
  if (task.repeat_frequency === 'weekly') return formatDateISO(addWeeks(currentDate, interval))
  if (task.repeat_frequency === 'monthly') return formatDateISO(addMonths(currentDate, interval))
  if (task.repeat_frequency === 'yearly') return formatDateISO(addYears(currentDate, interval))

  return null
}


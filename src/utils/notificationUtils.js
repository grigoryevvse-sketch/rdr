export const CUSTOM_NOTIFICATION_PREFIX = 'custom:'
export const CUSTOM_NOTIFICATION_UNITS = [
  { value: 'minutes', label: 'min', multiplier: 1 },
  { value: 'hours', label: 'hours', multiplier: 60 },
  { value: 'days', label: 'days', multiplier: 1_440 },
  { value: 'weeks', label: 'weeks', multiplier: 10_080 },
]
export const MAX_CUSTOM_NOTIFICATION_MINUTES = 10_080

function clampCustomMinutes(minutes) {
  return Math.max(1, Math.min(MAX_CUSTOM_NOTIFICATION_MINUTES, Math.round(Number(minutes) || 1)))
}

export function customReminderToMinutes(value, unit = 'minutes') {
  const selectedUnit = CUSTOM_NOTIFICATION_UNITS.find((option) => option.value === unit) || CUSTOM_NOTIFICATION_UNITS[0]
  return clampCustomMinutes((Number(value) || 1) * selectedUnit.multiplier)
}

export function splitCustomReminderMinutes(minutes) {
  const safeMinutes = clampCustomMinutes(minutes)
  const units = [...CUSTOM_NOTIFICATION_UNITS].reverse()
  const exactUnit = units.find((unit) => safeMinutes % unit.multiplier === 0)

  if (exactUnit) {
    return {
      value: safeMinutes / exactUnit.multiplier,
      unit: exactUnit.value,
    }
  }

  return {
    value: safeMinutes,
    unit: 'minutes',
  }
}

export function isCustomNotificationMoment(momentId) {
  return typeof momentId === 'string' && momentId.startsWith(CUSTOM_NOTIFICATION_PREFIX)
}

export function customNotificationId(minutes) {
  return `${CUSTOM_NOTIFICATION_PREFIX}${clampCustomMinutes(minutes)}`
}

export function getCustomNotificationMinutes(moments, fallback = 30) {
  const customMoment = Array.isArray(moments)
    ? moments.find(isCustomNotificationMoment)
    : null

  if (!customMoment) return fallback

  const minutes = Number(customMoment.replace(CUSTOM_NOTIFICATION_PREFIX, ''))
  return Number.isFinite(minutes) ? minutes : fallback
}

export function getCustomNotificationMinutesList(moments) {
  if (!Array.isArray(moments)) return []

  return moments
    .filter(isCustomNotificationMoment)
    .map((momentId) => Number(momentId.replace(CUSTOM_NOTIFICATION_PREFIX, '')))
    .filter(Number.isFinite)
}

export function hasCustomNotificationMoment(moments) {
  return Array.isArray(moments) && moments.some(isCustomNotificationMoment)
}

export function setCustomNotificationMoment(moments, minutes, enabled) {
  const withoutCustom = (Array.isArray(moments) ? moments : []).filter((momentId) => (
    !isCustomNotificationMoment(momentId)
  ))

  return enabled ? [...withoutCustom, customNotificationId(minutes)] : withoutCustom
}

export function addCustomNotificationMoment(moments, minutes) {
  const current = Array.isArray(moments) ? moments : []
  const nextMomentId = customNotificationId(minutes)

  if (current.includes(nextMomentId)) return current

  return [...current, nextMomentId]
}

export function updateCustomNotificationMoment(moments, oldMinutes, nextMinutes) {
  const oldMomentId = customNotificationId(oldMinutes)
  const nextMomentId = customNotificationId(nextMinutes)
  const current = Array.isArray(moments) ? moments : []
  const withoutOld = current.filter((momentId) => momentId !== oldMomentId)

  if (withoutOld.includes(nextMomentId)) return withoutOld

  return [...withoutOld, nextMomentId]
}

export function removeCustomNotificationMoment(moments, minutes) {
  const momentIdToRemove = customNotificationId(minutes)

  return (Array.isArray(moments) ? moments : []).filter((momentId) => momentId !== momentIdToRemove)
}

export function formatMinutesBefore(minutes) {
  const value = Number(minutes) || 0
  if (value < 60) return `${value} min before`
  if (value % 10_080 === 0) {
    const weeks = value / 10_080
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} before`
  }
  if (value % 1_440 === 0) {
    const days = value / 1_440
    return `${days} ${days === 1 ? 'day' : 'days'} before`
  }
  if (value % 60 === 0) {
    const hours = value / 60
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} before`
  }

  const hours = Math.floor(value / 60)
  const rest = value % 60
  return `${hours} hr ${rest} min before`
}

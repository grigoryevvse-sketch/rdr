import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, Clock3, List, Plus, Repeat2, Trash2, X, ChevronRight, Send, Loader2 } from 'lucide-react'
import { DEFAULT_NOTIFICATION_MOMENTS, NOTIFICATION_MOMENTS, TASK_ICONS } from '../../utils/constants'
import { REPEAT_FREQUENCIES } from '../../utils/repeatUtils'
import {
  addCustomNotificationMoment,
  customReminderToMinutes,
  CUSTOM_NOTIFICATION_UNITS,
  formatMinutesBefore,
  getCustomNotificationMinutesList,
  removeCustomNotificationMoment,
  splitCustomReminderMinutes,
  updateCustomNotificationMoment,
} from '../../utils/notificationUtils'
import * as LucideIcons from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../utils/i18n'
import { sendTelegramReminder } from '../../utils/telegramUtils'

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]
const TIME_STEP_MINUTES = 15
const EXACT_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const TIME_OPTIONS = Array.from({ length: 24 * 60 / TIME_STEP_MINUTES }, (_, index) => {
  return minutesToTime(index * TIME_STEP_MINUTES)
})
const MOMENT_TEXT_RU = {
  start: ['В начале', 'Когда задача начинается'],
  before10: ['За 10 мин', 'Небольшое напоминание перед началом'],
  before60: ['За 1 час', 'Время подготовиться'],
  before1day: ['За 1 день', 'Напоминание за день'],
  before2days: ['За 2 дня', 'Напоминание за два дня'],
  before1week: ['За 1 неделю', 'Заранее для больших задач'],
  before1month: ['За 1 месяц', 'Долгосрочное напоминание'],
  finish: ['Когда закончится', 'Когда запланированное время закончится'],
}
const UNIT_LABELS_RU = {
  minutes: 'минут',
  hours: 'часов',
  days: 'дней',
  weeks: 'недель',
  months: 'месяцев',
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseTime(time) {
  const [hours = 9, minutes = 0] = (time || '09:00').split(':').map(Number)
  return { hours, minutes }
}

function formatTime(hours, minutes) {
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function timeToMinutes(time) {
  const { hours, minutes } = parseTime(time)
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  return formatTime(Math.floor(normalized / 60), normalized % 60)
}

function formatTimeLabel(time) {
  const { hours, minutes } = parseTime(time)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function normalizeTimeInput(time) {
  const { hours, minutes } = parseTime(time)
  return formatTime(clamp(hours || 0, 0, 23), clamp(minutes || 0, 0, 59))
}

function formatDurationLabel(minutes, language = 'en') {
  if (language === 'ru') {
    if (minutes < 60) return `${minutes} мин`
    if (minutes % 60 === 0) return `${minutes / 60} ч`
    return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
  }

  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}

export default function AddTaskModal({ onClose, onAdd, selectedDate, initialTask, mode = 'add', showDateField = false, onShare }) {
  const { accentColor, theme, language, notificationSettings } = useApp()
  const initialStartTime = normalizeTimeInput(initialTask?.start_time || '09:00')
  const [title, setTitle] = useState(initialTask?.title || '')
  const [date, setDate] = useState(initialTask?.date || selectedDate)
  const [startTime, setStartTime] = useState(initialStartTime)
  const [exactTimeDraft, setExactTimeDraft] = useState(initialStartTime)
  const [timeInputMode, setTimeInputMode] = useState(
    initialTask?.start_time && !TIME_OPTIONS.includes(initialStartTime) ? 'exact' : 'scroll'
  )
  const [duration, setDuration] = useState(initialTask?.duration || 30)
  const [durationMode, setDurationMode] = useState(
    DURATION_PRESETS.includes(initialTask?.duration || 30) ? 'preset' : 'custom'
  )
  const [icon, setIcon] = useState(initialTask?.icon || TASK_ICONS[0])
  const [repeatEnabled, setRepeatEnabled] = useState(
    Boolean(initialTask?.repeat_frequency && initialTask.repeat_frequency !== 'none')
  )
  const [repeatFrequency, setRepeatFrequency] = useState(
    initialTask?.repeat_frequency && initialTask.repeat_frequency !== 'none'
      ? initialTask.repeat_frequency
      : 'weekly'
  )
  const [notificationMoments, setNotificationMoments] = useState(
    Array.isArray(initialTask?.notification_moments)
      ? initialTask.notification_moments
      : notificationSettings.defaultMoments || DEFAULT_NOTIFICATION_MOMENTS
  )
  const [newCustomReminderValue, setNewCustomReminderValue] = useState(30)
  const [newCustomReminderUnit, setNewCustomReminderUnit] = useState('minutes')

  // Sharing states
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [recipientInput, setRecipientInput] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareStatus, setShareStatus] = useState(null)
  const [recentShares, setRecentShares] = useState([])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('planner-recent-shares') || '[]')
      if (Array.isArray(saved)) setRecentShares(saved)
    } catch {}
  }, [])
  const customReminderMinutes = getCustomNotificationMinutesList(notificationMoments)
  const selectedTimeRef = useRef(null)
  const dateInputRef = useRef(null)
  const scrollRafRef = useRef(null)
  const isSyncingFromScrollRef = useRef(false)
  const startMinutes = timeToMinutes(startTime)
  const timeOptions = useMemo(() => {
    const options = TIME_OPTIONS.includes(startTime) ? TIME_OPTIONS : [...TIME_OPTIONS, startTime]
    const uniqueOptions = new Map(options.map((option) => [timeToMinutes(option), normalizeTimeInput(option)]))
    return [...uniqueOptions.values()].sort((a, b) => timeToMinutes(a) - timeToMinutes(b))
  }, [startTime])
  const fieldClass = theme === 'dark'
    ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
    : 'bg-gray-50 border border-gray-200 text-gray-900 focus:border-accent'
  const panelClass = theme === 'dark'
    ? 'bg-white/[0.04] border border-white/10'
    : 'bg-gray-50 border border-gray-200'

  async function handleShare() {
    if (!recipientInput.trim() || !onShare) return
    const targetRecipient = recipientInput.trim()
    setShareLoading(true)
    setShareStatus(null)
    try {
      const res = await onShare(initialTask.id, targetRecipient)
      
      // Save to recent shares
      const savedShares = JSON.parse(localStorage.getItem('planner-recent-shares') || '[]')
      const nextShares = [targetRecipient, ...savedShares.filter(s => s !== targetRecipient)].slice(0, 5)
      localStorage.setItem('planner-recent-shares', JSON.stringify(nextShares))
      setRecentShares(nextShares)

      // Send Telegram notification if the recipient has Telegram enabled
      if (res.recipient_chat_id) {
        const dateFormatted = initialTask.date || selectedDate
        const senderName = res.sender_name || 'Кто-то'
        const telegramMessage = res.recipient_language === 'ru'
          ? `🔔 Пользователь ${senderName} поделился с вами задачей:\n📍 *${initialTask.title}*\n📅 Дата: ${dateFormatted}\n⏰ Время: ${initialTask.start_time || '09:00'}`
          : `🔔 User ${senderName} shared a task with you:\n📍 *${initialTask.title}*\n📅 Date: ${dateFormatted}\n⏰ Time: ${initialTask.start_time || '09:00'}`;
        await sendTelegramReminder(telegramMessage, res.recipient_chat_id)
      }

      setShareLoading(false)
      setShareStatus({
        success: true,
        message: language === 'ru'
          ? `Задача успешно отправлена пользователю ${res.recipient_email || targetRecipient}`
          : `Task shared successfully with ${res.recipient_email || targetRecipient}!`,
      })
      setRecipientInput('')
    } catch (err) {
      setShareLoading(false)
      setShareStatus({
        success: false,
        message: err.message || (language === 'ru' ? 'Не удалось отправить задачу.' : 'Failed to share task.'),
      })
    }
  }

  useEffect(() => {
    if (isSyncingFromScrollRef.current) {
      isSyncingFromScrollRef.current = false
      setExactTimeDraft(normalizeTimeInput(startTime))
      return
    }
    selectedTimeRef.current?.scrollIntoView({ block: 'center' })
    setExactTimeDraft(normalizeTimeInput(startTime))
  }, [startTime])

  useEffect(() => {
    if (timeInputMode !== 'scroll') return

    const frameId = requestAnimationFrame(() => {
      selectedTimeRef.current?.scrollIntoView({ block: 'center' })
    })

    return () => cancelAnimationFrame(frameId)
  }, [timeInputMode])

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  function handleSubmit(e) {
    e?.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      start_time: startTime,
      duration,
      color: accentColor,
      icon,
      date: dateInputRef.current?.value || date,
      notification_moments: notificationMoments,
      repeat_frequency: repeatEnabled ? repeatFrequency : 'none',
      repeat_interval: 1,
    })
  }

  function setPresetDuration(minutes) {
    setDurationMode('preset')
    setDuration(minutes)
  }

  function setCustomDuration(value) {
    setDurationMode('custom')
    setDuration(clamp(Number(value) || 1, 1, 720))
  }

  function updateExactStartTime(value) {
    const nextValue = value.replace(/[^\d:]/g, '').slice(0, 5)
    setExactTimeDraft(nextValue)
    if (EXACT_TIME_PATTERN.test(nextValue)) setStartTime(normalizeTimeInput(nextValue))
  }

  function commitExactStartTime() {
    if (EXACT_TIME_PATTERN.test(exactTimeDraft)) {
      setStartTime(normalizeTimeInput(exactTimeDraft))
      return
    }

    setExactTimeDraft(normalizeTimeInput(startTime))
  }

  function toggleNotificationMoment(momentId) {
    setNotificationMoments((current) => (
      current.includes(momentId)
        ? current.filter((id) => id !== momentId)
        : [...current, momentId]
    ))
  }

  function addCustomReminder() {
    const minutes = customReminderToMinutes(newCustomReminderValue, newCustomReminderUnit)
    setNotificationMoments((current) => (
      addCustomNotificationMoment(current, minutes)
    ))
    const reminder = splitCustomReminderMinutes(minutes)
    setNewCustomReminderValue(reminder.value)
    setNewCustomReminderUnit(reminder.unit)
  }

  function updateCustomReminder(oldMinutes, value, unit) {
    const nextMinutes = customReminderToMinutes(value, unit)
    setNotificationMoments((current) => (
      updateCustomNotificationMoment(current, oldMinutes, nextMinutes)
    ))
  }

  function removeCustomReminder(minutes) {
    setNotificationMoments((current) => (
      removeCustomNotificationMoment(current, minutes)
    ))
  }

  function handleTimeScroll(e) {
    if (scrollRafRef.current) return

    const scrollContainer = e.currentTarget
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null

      const containerRect = scrollContainer.getBoundingClientRect()
      const containerCenter = containerRect.top + containerRect.height / 2
      const options = scrollContainer.querySelectorAll('[data-time-option]')
      let closestTime = startTime
      let closestDistance = Infinity

      options.forEach((option) => {
        const optionRect = option.getBoundingClientRect()
        const optionCenter = optionRect.top + optionRect.height / 2
        const distance = Math.abs(optionCenter - containerCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closestTime = option.dataset.timeOption
        }
      })

      if (closestTime && closestTime !== startTime) {
        isSyncingFromScrollRef.current = true
        setStartTime(normalizeTimeInput(closestTime))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`safe-modal-sheet relative w-full max-w-md overflow-y-auto mx-4 rounded-t-3xl md:rounded-3xl p-6
                       animate-slide-up
                       ${theme === 'dark' ? 'bg-[#1a1a24] border border-white/10' : 'bg-white border border-gray-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {mode === 'edit' ? t(language, 'calendar.editTask') : t(language, 'calendar.newTask')}
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSubmit}
              aria-label={mode === 'edit' ? t(language, 'calendar.saveTask') : t(language, 'calendar.addTask')}
              className="md:hidden w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              <Check size={18} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer">
              <X size={18} className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(language, 'calendar.taskName')}
            autoFocus
            className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all
              ${fieldClass} ${theme === 'dark' ? 'placeholder-gray-500' : 'placeholder-gray-400'}`}
          />

          {(mode === 'edit' || showDateField) && (
            <div>
              <label className={`text-xs font-medium mb-1.5 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t(language, 'calendar.date')}
              </label>
              <input
                ref={dateInputRef}
                type="date"
                defaultValue={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${fieldClass}`}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className={`text-xs font-medium block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t(language, 'calendar.startTime')}
              </label>
              <div className={`grid grid-cols-2 rounded-xl p-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                <button
                  type="button"
                  onClick={() => setTimeInputMode('scroll')}
                  title={t(language, 'calendar.chooseFromList')}
                  aria-label={t(language, 'calendar.chooseFromList')}
                  className={`h-8 w-10 rounded-lg flex items-center justify-center transition cursor-pointer
                    ${timeInputMode === 'scroll'
                      ? 'bg-accent text-white shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <List size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setTimeInputMode('exact')}
                  title={t(language, 'calendar.enterExactTime')}
                  aria-label={t(language, 'calendar.enterExactTime')}
                  className={`h-8 w-10 rounded-lg flex items-center justify-center transition cursor-pointer
                    ${timeInputMode === 'exact'
                      ? 'bg-accent text-white shadow-sm'
                      : theme === 'dark'
                        ? 'text-gray-400 hover:text-white'
                        : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <Clock3 size={15} />
                </button>
              </div>
            </div>
            <div
              className={`relative rounded-2xl px-3 py-1.5 ${panelClass}`}
            >
              {timeInputMode === 'scroll' ? (
                <>
                  <div className={`pointer-events-none absolute inset-x-3 top-1.5 h-6 rounded-t-xl bg-gradient-to-b ${theme === 'dark' ? 'from-[#1a1a24]' : 'from-gray-50'} to-transparent`} />
                  <div className={`pointer-events-none absolute inset-x-3 bottom-1.5 h-6 rounded-b-xl bg-gradient-to-t ${theme === 'dark' ? 'from-[#1a1a24]' : 'from-gray-50'} to-transparent`} />
                  <div
                    onScroll={handleTimeScroll}
                    className="h-[6.75rem] overflow-y-auto overscroll-contain py-[2.375rem] snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <div className="flex flex-col gap-1">
                      {timeOptions.map((value) => {
                        const isSelected = value === startTime
                        const endTime = minutesToTime(timeToMinutes(value) + duration)
                        const rawDistance = Math.abs(timeToMinutes(value) - startMinutes) / TIME_STEP_MINUTES
                        const distance = Math.min(rawDistance, timeOptions.length - rawDistance)
                        return (
                          <button
                            key={value}
                            ref={isSelected ? selectedTimeRef : null}
                            type="button"
                            data-time-option={value}
                            onClick={() => {
                              const nextTime = normalizeTimeInput(value)
                              setStartTime(nextTime)
                              setExactTimeDraft(nextTime)
                            }}
                            className={`mx-auto h-8 w-full max-w-[13rem] shrink-0 snap-center rounded-full text-center text-xs font-semibold transition-all cursor-pointer
                              ${isSelected
                                ? 'bg-accent text-white text-sm shadow-sm'
                                : theme === 'dark'
                                  ? 'text-gray-400 hover:text-white'
                                  : 'text-gray-500 hover:text-gray-900'}
                              ${distance === 1 ? 'opacity-65' : ''}
                              ${distance === 2 ? 'opacity-25' : ''}`}
                          >
                            {isSelected
                              ? `${formatTimeLabel(value)}-${formatTimeLabel(endTime)}`
                              : formatTimeLabel(value)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-[auto_1fr] gap-3 items-center py-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-500 border border-gray-200'}`}>
                    <Clock3 size={17} />
                  </span>
                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-2][0-9]:[0-5][0-9]"
                      maxLength={5}
                      placeholder="09:00"
                      value={exactTimeDraft}
                      onChange={(e) => updateExactStartTime(e.target.value)}
                      onBlur={commitExactStartTime}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${fieldClass}`}
                    />
                    <p className={`mt-1.5 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {t(language, 'calendar.endsAt')} {formatTimeLabel(minutesToTime(timeToMinutes(startTime) + duration))}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label
              className={`flex items-center gap-3 rounded-2xl p-3 transition cursor-pointer ${panelClass}`}
            >
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(e) => setRepeatEnabled(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
                style={{ accentColor: 'var(--color-accent)' }}
              />
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-500 border border-gray-200'}`}>
                <Repeat2 size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t(language, 'calendar.repeatThisTask')}
                </span>
                <span className={`block text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t(language, 'calendar.repeatHelp')}
                </span>
              </span>
            </label>

            {repeatEnabled && (
              <div className={`mt-2 rounded-2xl p-3 animate-fade-in ${panelClass}`}>
                <label className={`text-xs font-medium mb-2 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t(language, 'calendar.repeatSchedule')}
                </label>
                <select
                  value={repeatFrequency}
                  onChange={(e) => setRepeatFrequency(e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer ${fieldClass}`}
                >
                  {REPEAT_FREQUENCIES.map((frequency) => (
                    <option key={frequency.value} value={frequency.value}>
                      {frequency.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-medium block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t(language, 'calendar.duration')}
              </label>
              <span className="text-xs font-semibold text-accent">{formatDurationLabel(duration, language)}</span>
            </div>
            <div className={`rounded-2xl p-3 space-y-3 ${panelClass}`}>
              <div className="grid grid-cols-3 gap-2">
                {DURATION_PRESETS.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setPresetDuration(minutes)}
                    className={`h-10 rounded-xl text-xs font-semibold transition cursor-pointer
                      ${durationMode === 'preset' && duration === minutes
                        ? 'bg-accent text-white shadow-sm'
                        : theme === 'dark'
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10'
                          : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {formatDurationLabel(minutes, language)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDurationMode('custom')}
                className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-left transition cursor-pointer
                  ${durationMode === 'custom'
                    ? 'bg-accent/15 text-accent border border-accent/40'
                    : theme === 'dark'
                      ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                {t(language, 'calendar.custom')}
              </button>

              {durationMode === 'custom' && (
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center animate-fade-in">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    step="1"
                    value={duration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${fieldClass}`}
                  />
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t(language, 'common.minuteShort')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className={`text-xs font-medium mb-2 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {t(language, 'calendar.icon')}
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {TASK_ICONS.map((iconName) => {
                const name = iconName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
                const IC = LucideIcons[name] || LucideIcons.Circle
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setIcon(iconName)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer
                      ${icon === iconName
                        ? 'bg-accent/20 text-accent'
                        : theme === 'dark'
                          ? 'bg-white/5 text-gray-400 hover:text-white'
                          : 'bg-gray-100 text-gray-400 hover:text-gray-700'}`}
                  >
                    <IC size={16} />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-xs font-medium block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t(language, 'calendar.notifications')}
              </label>
              <span className={`text-[11px] font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {notificationMoments.length
                  ? (language === 'ru' ? `${notificationMoments.length} выбрано` : `${notificationMoments.length} selected`)
                  : (language === 'ru' ? 'Выключено для этой задачи' : 'Off for this task')}
              </span>
            </div>
            <div className={`rounded-2xl p-3 space-y-2 ${panelClass}`}>
              {NOTIFICATION_MOMENTS.map((moment) => {
                const selected = notificationMoments.includes(moment.id)
                return (
                  <button
                    key={moment.id}
                    type="button"
                    onClick={() => toggleNotificationMoment(moment.id)}
                    className={`w-full min-h-12 rounded-xl px-3 py-2 flex items-center gap-3 text-left transition cursor-pointer
                      ${selected
                        ? 'bg-accent/15 border border-accent/40 text-accent'
                        : theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                      ${selected ? 'bg-accent text-white' : theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}
                    >
                      <Bell size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{language === 'ru' ? MOMENT_TEXT_RU[moment.id]?.[0] || moment.label : moment.label}</span>
                      <span className={`block text-xs ${selected ? 'text-accent/80' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {language === 'ru' ? MOMENT_TEXT_RU[moment.id]?.[1] || moment.description : moment.description}
                      </span>
                    </span>
                  </button>
                )
              })}

              <div className={`rounded-xl border p-3 transition
                ${customReminderMinutes.length
                  ? 'bg-accent/15 border-accent/40'
                  : theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-white border-gray-200'}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                    ${customReminderMinutes.length ? 'bg-accent text-white' : theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <Bell size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${customReminderMinutes.length ? 'text-accent' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {language === 'ru' ? 'Свои напоминания' : 'Custom reminders'}
                    </span>
                    <span className={`block text-xs ${customReminderMinutes.length ? 'text-accent/80' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {language === 'ru' ? 'Добавь уведомления до начала' : 'Add alerts before start'}
                    </span>
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  {customReminderMinutes.map((minutes) => {
                    const reminder = splitCustomReminderMinutes(minutes)
                    return (
                    <div key={`custom-${minutes}`} className="grid grid-cols-[minmax(0,1fr)_7.25rem_auto] gap-2 items-center animate-fade-in">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={reminder.value}
                        onChange={(e) => updateCustomReminder(minutes, e.target.value, reminder.unit)}
                        aria-label={`Custom reminder ${formatMinutesBefore(minutes)}`}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${fieldClass}`}
                      />
                      <select
                        value={reminder.unit}
                        onChange={(e) => updateCustomReminder(minutes, reminder.value, e.target.value)}
                        aria-label={`Custom reminder unit for ${formatMinutesBefore(minutes)}`}
                        className={`w-full px-2 py-2.5 rounded-xl text-sm outline-none cursor-pointer ${fieldClass}`}
                      >
                        {CUSTOM_NOTIFICATION_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>{language === 'ru' ? UNIT_LABELS_RU[unit.value] || unit.label : unit.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCustomReminder(minutes)}
                        aria-label={`Remove ${formatMinutesBefore(minutes)}`}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer
                          ${theme === 'dark'
                            ? 'bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-300 border border-white/10'
                            : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200'}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    )
                  })}

                  <div className="grid grid-cols-[minmax(0,1fr)_7.25rem_auto] gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newCustomReminderValue}
                      onChange={(e) => setNewCustomReminderValue(Math.max(1, Number(e.target.value) || 1))}
                      aria-label={language === 'ru' ? 'Новое своё напоминание' : 'New custom reminder amount'}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none ${fieldClass}`}
                    />
                    <select
                      value={newCustomReminderUnit}
                      onChange={(e) => setNewCustomReminderUnit(e.target.value)}
                      aria-label={language === 'ru' ? 'Единица нового напоминания' : 'New custom reminder unit'}
                      className={`w-full px-2 py-2.5 rounded-xl text-sm outline-none cursor-pointer ${fieldClass}`}
                    >
                      {CUSTOM_NOTIFICATION_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>{language === 'ru' ? UNIT_LABELS_RU[unit.value] || unit.label : unit.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCustomReminder}
                      className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      aria-label={language === 'ru' ? 'Добавить своё напоминание' : 'Add custom reminder'}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Share Task Section */}
          {mode === 'edit' && onShare && (
            <div>
              <button
                type="button"
                onClick={() => setShowSharePanel(!showSharePanel)}
                className={`w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-left transition cursor-pointer flex items-center justify-between
                  ${showSharePanel
                    ? 'bg-accent/15 text-accent border border-accent/40'
                    : theme === 'dark'
                      ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                <div className="flex items-center gap-2">
                  <Send size={14} />
                  <span>{language === 'ru' ? 'Поделиться задачей' : 'Share Task'}</span>
                </div>
                <ChevronRight size={14} className={`transition-transform duration-200 ${showSharePanel ? 'rotate-90' : ''}`} />
              </button>

              {showSharePanel && (
                <div className={`mt-2 rounded-2xl p-4 space-y-3 animate-fade-in ${panelClass}`}>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {language === 'ru'
                      ? 'Введите никнейм (@username), email или Telegram имя получателя.'
                      : "Enter the recipient's username handle (@username), email, or Telegram username."}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={language === 'ru' ? 'например, @valeriya или email' : 'e.g. @valeriya or email'}
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl text-xs outline-none ${fieldClass}`}
                    />
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={shareLoading || !recipientInput.trim()}
                      className="px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                    >
                      {shareLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        language === 'ru' ? 'Отправить' : 'Send'
                      )}
                    </button>
                  </div>
                  {recentShares.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {language === 'ru' ? 'Недавние получатели' : 'Recent recipients'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentShares.map((share) => (
                          <button
                            key={share}
                            type="button"
                            onClick={() => setRecipientInput(share)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition cursor-pointer border
                              ${recipientInput === share
                                ? 'bg-accent/20 border-accent/40 text-accent'
                                : theme === 'dark'
                                  ? 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {share}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {shareStatus && (
                    <p className={`text-xs font-medium ${shareStatus.success ? 'text-accent' : 'text-red-400'}`}>
                      {shareStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl font-semibold text-sm text-white
                       bg-accent hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            {mode === 'edit' ? t(language, 'calendar.saveTask') : t(language, 'calendar.addTask')}
          </button>
        </form>
      </div>
    </div>
  )
}

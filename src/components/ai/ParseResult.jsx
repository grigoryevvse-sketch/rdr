import { CalendarDays, Inbox, Check, X, Clock, AlignLeft, Bell, Repeat, Trash2, Pencil } from 'lucide-react'
import { format, parseISO, isValid, isToday, isTomorrow } from 'date-fns'
import { formatTime12h } from '../../utils/dateUtils'
import { useApp } from '../../context/AppContext'
import { NOTIFICATION_MOMENTS } from '../../utils/constants'
import { formatMinutesBefore, isCustomNotificationMoment } from '../../utils/notificationUtils'
import { REPEAT_FREQUENCIES } from '../../utils/repeatUtils'
import { DATE_LOCALES, t } from '../../utils/i18n'

const REPEAT_LABELS_RU = {
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
  yearly: 'Ежегодно',
}

function formatResultDate(date, language) {
  const parsed = parseISO(date)
  if (!isValid(parsed)) return t(language, 'common.today')
  if (isToday(parsed)) return t(language, 'common.today')
  if (isTomorrow(parsed)) return t(language, 'common.tomorrow')
  return format(parsed, 'EEEE, MMMM d', { locale: DATE_LOCALES[language] })
}

function getReminderLabels(result) {
  return Array.isArray(result.notification_moments)
    ? result.notification_moments.map((moment) => {
      if (isCustomNotificationMoment(moment)) {
        return formatMinutesBefore(moment.replace('custom:', ''))
      }
      return NOTIFICATION_MOMENTS.find((option) => option.id === moment)?.label
    }).filter(Boolean)
    : []
}

function ResultFields({ result, compact = false }) {
  const { theme, language } = useApp()
  const isSchedule = result.intent === 'schedule'
  const repeatLabel = REPEAT_FREQUENCIES.find((frequency) => (
    frequency.value === result.repeat_frequency
  ))
  const localizedRepeatLabel = language === 'ru'
    ? REPEAT_LABELS_RU[repeatLabel?.value] || repeatLabel?.label
    : repeatLabel?.label
  const reminderLabels = getReminderLabels(result)

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-start gap-3">
        <AlignLeft size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
        <div>
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t(language, 'common.task')}</p>
          <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {result.title}
          </p>
        </div>
      </div>

      {isSchedule && (
        <div className="flex items-start gap-3">
          <Clock size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t(language, 'common.time')}</p>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t(language, 'inbox.chatDate', formatResultDate(result.date, language), formatTime12h(result.time || '09:00'))}
              {!result.time && t(language, 'common.defaultSuffix')}
              {` · ${result.duration || 30} ${t(language, 'common.minuteShort')}`}
            </p>
          </div>
        </div>
      )}

      {isSchedule && localizedRepeatLabel && (
        <div className="flex items-start gap-3">
          <Repeat size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t(language, 'common.repeat')}</p>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {localizedRepeatLabel}
            </p>
          </div>
        </div>
      )}

      {isSchedule && reminderLabels.length > 0 && (
        <div className="flex items-start gap-3">
          <Bell size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{t(language, 'common.reminders')}</p>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {reminderLabels.join(', ')}
            </p>
          </div>
        </div>
      )}
      {result.notes && (
        <div className="flex items-start gap-3">
          <AlignLeft size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{language === 'ru' ? 'Заметки' : 'Notes'}</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'} whitespace-pre-line`}>
              {result.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParseResult({ result, onConfirm, onDismiss, onRemoveItem, onEditItem }) {
  const { theme, language } = useApp()
  const items = result.intent === 'batch' && Array.isArray(result.items)
    ? result.items
    : [result]
  const isBatch = items.length > 1
  const isSchedule = !isBatch && result.intent === 'schedule'

  return (
    <div className={`rounded-2xl p-5 animate-scale-in
      ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
      {/* Intent badge */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
          ${isSchedule ? 'bg-accent/15 text-accent' : 'bg-blue-500/15 text-blue-400'}`}>
          {isSchedule ? <CalendarDays size={12} /> : <Inbox size={12} />}
          {isBatch ? t(language, 'ai.plannedItems', items.length) : (isSchedule ? t(language, 'ai.schedule') : t(language, 'ai.addToInbox'))}
        </div>
        {isSchedule && (
          <button
            type="button"
            onClick={() => onEditItem?.(0)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer
              ${theme === 'dark'
                ? 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'}`}
            title={t(language, 'ai.editSuggestion')}
            aria-label={t(language, 'ai.editSuggestion')}
          >
            <Pencil size={15} />
          </button>
        )}
      </div>

      {/* Parsed fields */}
      {isBatch ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item.title}-${index}`}
              className={`flex items-start gap-3 rounded-xl p-3 ${theme === 'dark' ? 'bg-black/15' : 'bg-gray-50'}`}
            >
              <div className="min-w-0 flex-1">
                <ResultFields result={item} compact />
              </div>
              <button
                type="button"
                onClick={() => onRemoveItem?.(index)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer
                  ${theme === 'dark'
                    ? 'text-gray-500 hover:bg-white/10 hover:text-red-300'
                    : 'text-gray-400 hover:bg-white hover:text-red-500'}`}
                title={t(language, 'ai.removeSuggestion')}
              >
                <Trash2 size={16} />
              </button>
              {item.intent === 'schedule' && (
                <button
                  type="button"
                  onClick={() => onEditItem?.(index)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all cursor-pointer
                    ${theme === 'dark'
                      ? 'text-gray-500 hover:bg-white/10 hover:text-white'
                      : 'text-gray-400 hover:bg-white hover:text-gray-900'}`}
                  title={t(language, 'ai.editSuggestion')}
                  aria-label={t(language, 'ai.editSuggestion')}
                >
                  <Pencil size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ResultFields result={result} />
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        <button
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                     bg-accent text-white text-sm font-medium
                     hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Check size={16} />
          {t(language, 'common.confirm')}
        </button>
        <button
          onClick={onDismiss}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer
            ${theme === 'dark'
              ? 'bg-white/5 text-gray-400 hover:bg-white/10'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

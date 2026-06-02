import { CalendarDays, Inbox, Check, X, Clock, AlignLeft } from 'lucide-react'
import { format, parseISO, isValid, isToday, isTomorrow } from 'date-fns'
import { formatTime12h } from '../../utils/dateUtils'
import { useApp } from '../../context/AppContext'

function formatResultDate(date) {
  const parsed = parseISO(date)
  if (!isValid(parsed)) return 'Today'
  if (isToday(parsed)) return 'Today'
  if (isTomorrow(parsed)) return 'Tomorrow'
  return format(parsed, 'EEEE, MMMM d')
}

export default function ParseResult({ result, onConfirm, onDismiss }) {
  const { theme } = useApp()
  const isSchedule = result.intent === 'schedule'

  return (
    <div className={`rounded-2xl p-5 animate-scale-in
      ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200 shadow-sm'}`}>
      {/* Intent badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
          ${isSchedule ? 'bg-accent/15 text-accent' : 'bg-blue-500/15 text-blue-400'}`}>
          {isSchedule ? <CalendarDays size={12} /> : <Inbox size={12} />}
          {isSchedule ? 'Schedule' : 'Add to Inbox'}
        </div>
      </div>

      {/* Parsed fields */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <AlignLeft size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
          <div>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Task</p>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {result.title}
            </p>
          </div>
        </div>

        {isSchedule && (
          <div className="flex items-start gap-3">
            <Clock size={16} className={theme === 'dark' ? 'text-gray-500 mt-0.5' : 'text-gray-400 mt-0.5'} />
            <div>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Time</p>
              <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {formatResultDate(result.date)} at {formatTime12h(result.time || '09:00')}
                {!result.time && ' (default)'}
                {` · ${result.duration || 30} min`}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-5">
        <button
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                     bg-accent text-white text-sm font-medium
                     hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Check size={16} />
          Confirm
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

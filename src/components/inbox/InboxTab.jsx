import { useState } from 'react'
import { format, isValid, differenceInCalendarDays } from 'date-fns'
import { Inbox as InboxIcon, CheckCircle2, Cake } from 'lucide-react'
import TaskInput from './TaskInput'
import TaskItem from './TaskItem'
import AddTaskModal from '../calendar/AddTaskModal'
import { useApp } from '../../context/AppContext'
import { formatDateISO, formatTime12h, parseISO } from '../../utils/dateUtils'
import { DATE_LOCALES, t } from '../../utils/i18n'

function isBirthdayTask(task) {
  const title = (task.title || '').toLowerCase()
  return (
    // "Birthday: Name" or "Name's Birthday" or any title containing birthday/anniversary
    title.includes('birthday') ||
    title.includes('день рождения') ||
    title.includes('anniversary') ||
    task.icon === 'cake'
  )
}

/** Returns the next occurrence of the given date's month/day from today (or today if it's today). */
function getNextOccurrence(dateStr) {
  if (!dateStr) return null
  const base = parseISO(dateStr)
  if (!isValid(base)) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thisYear = new Date(today.getFullYear(), base.getMonth(), base.getDate())
  if (thisYear >= today) return thisYear
  return new Date(today.getFullYear() + 1, base.getMonth(), base.getDate())
}

function getScheduledDetail(task, language) {
  const parsedDate = task.date ? parseISO(task.date) : null
  const dateLabel = parsedDate && isValid(parsedDate)
    ? format(parsedDate, 'MMM d', { locale: DATE_LOCALES[language] })
    : task.date
  const timeLabel = task.start_time ? formatTime12h(task.start_time) : null
  return t(language, 'inbox.chatDate', dateLabel, timeLabel)
}

export default function InboxTab({
  inboxTasks,
  scheduledTasks = [],
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onScheduleTask,
  onToggleScheduledTask,
  onDeleteScheduledTask,
}) {
  const { theme, language } = useApp()
  const [schedulingTask, setSchedulingTask] = useState(null)
  const [viewMode, setViewMode] = useState('inbox')

  const pending = inboxTasks.filter(t => !t.completed)
  const completed = inboxTasks.filter(t => t.completed)

  const allTasks = [
    ...inboxTasks.map((task) => ({
      ...task,
      source: 'inbox',
      sortDate: '9999-12-31',
      sortTime: '99:99',
    })),
    ...scheduledTasks.map((task) => ({
      ...task,
      source: 'scheduled',
      sortDate: task.date || '9999-12-31',
      sortTime: task.start_time || '99:99',
    })),
  ].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return `${a.sortDate} ${a.sortTime}`.localeCompare(`${b.sortDate} ${b.sortTime}`)
  })
  const allPending = allTasks.filter(t => !t.completed)
  const allCompleted = allTasks.filter(t => t.completed)

  // Birthday tasks: detect from scheduledTasks and compute next occurrence
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const birthdayTasks = scheduledTasks
    .filter(isBirthdayTask)
    .map((task) => {
      const next = getNextOccurrence(task.date)
      const daysUntil = next ? differenceInCalendarDays(next, todayStart) : null
      return { ...task, _nextDate: next, _daysUntil: daysUntil }
    })
    .sort((a, b) => {
      if (a._daysUntil === null) return 1
      if (b._daysUntil === null) return -1
      return a._daysUntil - b._daysUntil
    })

  const showingAll = viewMode === 'all'
  const showingBirthdays = viewMode === 'birthdays'
  const visiblePending = showingAll ? allPending : pending
  const visibleCompleted = showingAll ? allCompleted : completed

  const tabs = [
    { id: 'inbox', label: t(language, 'inbox.title'), count: inboxTasks.length },
    { id: 'all', label: t(language, 'inbox.all'), count: allTasks.length },
    { id: 'birthdays', label: t(language, 'inbox.birthdays'), count: birthdayTasks.length },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`safe-header px-6 pb-5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t(language, 'inbox.title')}
            </h1>
            <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {showingBirthdays
                ? t(language, 'inbox.birthdays')
                : t(language, 'inbox.remaining', visiblePending.length)}
            </p>
          </div>

          {/* 3-way toggle */}
          <div className={`grid grid-cols-3 rounded-xl border p-1 text-xs font-semibold
            ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            {tabs.map((option) => (
              <button
                key={option.id}
                onClick={() => setViewMode(option.id)}
                className={`min-w-[3.5rem] rounded-lg px-2 py-1.5 transition cursor-pointer flex items-center justify-center gap-1
                  ${viewMode === option.id
                    ? 'bg-accent text-white shadow-sm'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'}`}
              >
                {option.id === 'birthdays' && (
                  <Cake size={11} className="shrink-0" />
                )}
                <span>{option.label}</span>
                <span className={`${viewMode === option.id ? 'opacity-60' : 'opacity-40'}`}>{option.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task input — only in inbox/all modes */}
      {!showingBirthdays && (
        <div className="px-6 pt-4">
          <TaskInput onAdd={onAddTask} />
        </div>
      )}

      {/* ── BIRTHDAYS VIEW ── */}
      {showingBirthdays ? (
        <div className="safe-scroll-bottom flex-1 overflow-y-auto px-6 pt-4 space-y-2">
          {birthdayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <Cake size={40} className="mb-3" />
              <p className="text-sm font-medium">{t(language, 'inbox.noBirthdays')}</p>
              <p className="text-xs mt-1.5 text-center max-w-[220px] opacity-70">
                {t(language, 'inbox.noBirthdaysHint')}
              </p>
            </div>
          ) : (
            birthdayTasks.map((task) => {
              const daysUntil = task._daysUntil
              const nextDate = task._nextDate
              const isToday = daysUntil === 0
              const isTomorrow = daysUntil === 1
              const isSoon = daysUntil !== null && daysUntil <= 7

              const badgeLabel = daysUntil !== null
                ? t(language, 'inbox.birthdayIn', daysUntil)
                : null

              const badgeBg = isToday
                ? 'bg-pink-500 text-white'
                : isTomorrow
                  ? 'bg-orange-400 text-white'
                  : isSoon
                    ? 'bg-accent/20 text-accent'
                    : theme === 'dark'
                      ? 'bg-white/10 text-gray-400'
                      : 'bg-gray-100 text-gray-500'

              // Strip "Birthday: " prefix or "'s Birthday" suffix to show only the name
              const displayName = task.title
                .replace(/^(birthday|день\s+рождения|anniversary)\s*:\s*/i, '')
                .replace(/['']s\s+(birthday|anniversary)\s*$/i, '')
                .trim() || task.title

              const dateLabel = nextDate
                ? format(nextDate, 'MMMM d', { locale: DATE_LOCALES[language] })
                : null

              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all
                    ${isToday
                      ? theme === 'dark'
                        ? 'bg-pink-500/10 border border-pink-500/30'
                        : 'bg-pink-50 border border-pink-200'
                      : theme === 'dark'
                        ? 'bg-white/[0.04] border border-white/8 hover:bg-white/[0.07]'
                        : 'bg-white border border-gray-100 hover:bg-gray-50 shadow-sm'}`}
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${isToday
                      ? 'bg-pink-500 text-white'
                      : theme === 'dark'
                        ? 'bg-white/10 text-gray-300'
                        : 'bg-pink-50 text-pink-500'}`}
                  >
                    <Cake size={18} />
                  </div>

                  {/* Name + date */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {displayName}
                    </p>
                    {dateLabel && (
                      <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {dateLabel}
                      </p>
                    )}
                  </div>

                  {/* Countdown badge */}
                  {badgeLabel && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* ── INBOX / ALL TASKS VIEW ── */
        <div className="safe-scroll-bottom flex-1 overflow-y-auto px-6 pt-3 space-y-1">
          {visiblePending.length === 0 && visibleCompleted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <InboxIcon size={40} className="mb-3" />
              <p className="text-sm">{showingAll ? t(language, 'inbox.noTasks') : t(language, 'inbox.empty')}</p>
            </div>
          )}

          {visiblePending.map(task => (
            <TaskItem
              key={`${task.source || 'inbox'}-${task.id}`}
              task={task}
              detail={task.source === 'scheduled' ? getScheduledDetail(task, language) : undefined}
              badge={task.source === 'scheduled' ? t(language, 'inbox.scheduled') : undefined}
              onToggle={() => (
                task.source === 'scheduled'
                  ? onToggleScheduledTask?.(task.id, { completed: !task.completed })
                  : onToggleTask(task.id)
              )}
              onDelete={() => (
                task.source === 'scheduled'
                  ? onDeleteScheduledTask?.(task.id)
                  : onDeleteTask(task.id)
              )}
              onSchedule={task.source === 'scheduled' ? undefined : () => setSchedulingTask(task)}
            />
          ))}

          {visibleCompleted.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4 pb-2">
                <CheckCircle2 size={14} className="text-accent opacity-60" />
                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {t(language, 'inbox.completed', visibleCompleted.length)}
                </span>
              </div>
              {visibleCompleted.map(task => (
                <TaskItem
                  key={`${task.source || 'inbox'}-${task.id}`}
                  task={task}
                  detail={task.source === 'scheduled' ? getScheduledDetail(task, language) : undefined}
                  badge={task.source === 'scheduled' ? t(language, 'inbox.scheduled') : undefined}
                  onToggle={() => (
                    task.source === 'scheduled'
                      ? onToggleScheduledTask?.(task.id, { completed: !task.completed })
                      : onToggleTask(task.id)
                  )}
                  onDelete={() => (
                    task.source === 'scheduled'
                      ? onDeleteScheduledTask?.(task.id)
                      : onDeleteTask(task.id)
                  )}
                />
              ))}
            </>
          )}
        </div>
      )}

      {schedulingTask && (
        <AddTaskModal
          showDateField
          initialTask={{ title: schedulingTask.title }}
          selectedDate={formatDateISO(new Date())}
          onClose={() => setSchedulingTask(null)}
          onAdd={(task) => {
            onScheduleTask(schedulingTask.id, task)
            setSchedulingTask(null)
          }}
        />
      )}
    </div>
  )
}

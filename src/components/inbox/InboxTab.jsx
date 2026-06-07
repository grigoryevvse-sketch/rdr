import { useState } from 'react'
import { format, isValid } from 'date-fns'
import { Inbox as InboxIcon, CheckCircle2 } from 'lucide-react'
import TaskInput from './TaskInput'
import TaskItem from './TaskItem'
import AddTaskModal from '../calendar/AddTaskModal'
import { useApp } from '../../context/AppContext'
import { formatDateISO, formatTime12h, parseISO } from '../../utils/dateUtils'
import { DATE_LOCALES, t } from '../../utils/i18n'

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
  const showingAll = viewMode === 'all'
  const visiblePending = showingAll ? allPending : pending
  const visibleCompleted = showingAll ? allCompleted : completed

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
              {t(language, 'inbox.remaining', visiblePending.length)}
            </p>
          </div>

          <div className={`grid grid-cols-2 rounded-xl border p-1 text-xs font-semibold
            ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            {[
              { id: 'inbox', label: t(language, 'inbox.title'), count: inboxTasks.length },
              { id: 'all', label: t(language, 'inbox.all'), count: allTasks.length },
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => setViewMode(option.id)}
                className={`min-w-[4rem] rounded-lg px-2.5 py-1.5 transition cursor-pointer
                  ${viewMode === option.id
                    ? 'bg-accent text-white shadow-sm'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'}`}
              >
                {option.label} {option.count}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task input */}
      <div className="px-6 pt-4">
        <TaskInput onAdd={onAddTask} />
      </div>

      {/* Task list */}
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

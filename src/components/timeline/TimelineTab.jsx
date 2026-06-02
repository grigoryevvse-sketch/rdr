import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock3, Plus, Repeat2, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { addDays, format } from 'date-fns'
import AddTaskModal from '../calendar/AddTaskModal'
import {
  formatDateISO,
  formatSelectedDate,
  formatTime12h,
  getEndTime,
  isToday,
  parseISO,
  subDays,
} from '../../utils/dateUtils'
import { useApp } from '../../context/AppContext'
import { getRepeatLabel, isRepeatingTask } from '../../utils/repeatUtils'

function timeToMinutes(time) {
  const [hours = 0, minutes = 0] = (time || '00:00').split(':').map(Number)
  return hours * 60 + minutes
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) return `${minutes / 60} hr`
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`
}

function getTaskIcon(icon) {
  const iconName = icon
    ? icon.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join('')
    : 'Circle'
  return LucideIcons[iconName] || LucideIcons.Circle
}

function getOverlapIds(tasks) {
  const overlapping = new Set()
  const sorted = [...tasks].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))

  sorted.forEach((task, index) => {
    const taskStart = timeToMinutes(task.start_time)
    const taskEnd = taskStart + (task.duration || 0)

    sorted.slice(index + 1).forEach((nextTask) => {
      const nextStart = timeToMinutes(nextTask.start_time)
      if (nextStart >= taskEnd) return

      overlapping.add(task.id)
      overlapping.add(nextTask.id)
    })
  })

  return overlapping
}

export default function TimelineTab({ scheduledTasks, onAddTask, onUpdateTask, onDeleteTask, initialDate }) {
  const [selectedDateStr, setSelectedDateStr] = useState(initialDate || formatDateISO(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const { theme } = useApp()

  const selectedDate = parseISO(selectedDateStr)
  const dailyTasks = useMemo(() => (
    scheduledTasks
      .filter((task) => task.date === selectedDateStr && typeof task.start_time === 'string')
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))
  ), [scheduledTasks, selectedDateStr])
  const overlapIds = useMemo(() => getOverlapIds(dailyTasks), [dailyTasks])

  const firstHour = dailyTasks.length > 0
    ? formatTime12h(dailyTasks[0].start_time)
    : 'No tasks'
  const lastTask = dailyTasks[dailyTasks.length - 1]
  const lastHour = lastTask
    ? formatTime12h(getEndTime(lastTask.start_time, lastTask.duration || 0))
    : 'Today'

  function selectDate(date) {
    setSelectedDateStr(formatDateISO(date))
  }

  function handleToday() {
    setSelectedDateStr(formatDateISO(new Date()))
  }

  function handleUpdateTask(id, updates) {
    onUpdateTask(id, updates)
    if (updates.date) setSelectedDateStr(updates.date)
  }

  return (
    <div className="flex flex-col h-full">
      <div className={`safe-header px-6 pb-5 border-b ${theme === 'dark' ? 'border-white/5 bg-[#0f0f15]' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clock3 size={20} className="text-accent" />
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Timeline
              </h1>
            </div>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE')} · {formatSelectedDate(selectedDate)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToday}
              className={`h-10 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer
                ${isToday(selectedDate)
                  ? 'bg-accent/20 border-accent text-accent'
                  : theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                    : 'bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-800'}`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setEditingTask(null)
                setShowModal(true)
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent text-white hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-md"
              title="Add task"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => selectDate(subDays(selectedDate, 1))}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            title="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <div className={`flex-1 rounded-xl px-4 py-2 text-center border ${theme === 'dark' ? 'bg-white/[0.03] border-white/10 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            <span className="text-xs font-semibold">{firstHour}</span>
            <span className={`mx-2 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-300'}`}>-</span>
            <span className="text-xs font-semibold">{lastHour}</span>
          </div>
          <button
            onClick={() => selectDate(addDays(selectedDate, 1))}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'}`}
            title="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="safe-scroll-bottom flex-1 overflow-y-auto px-5 sm:px-8 pt-6">
        {dailyTasks.length === 0 ? (
          <div className={`h-full min-h-[18rem] flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            <Clock3 size={40} className="mb-3 opacity-60" />
            <p className="text-sm font-medium">No scheduled tasks</p>
          </div>
        ) : (
          <div className="relative max-w-4xl mx-auto">
            <div className={`absolute left-[4.65rem] top-5 bottom-5 w-px ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />

            <div className="space-y-4">
              {dailyTasks.map((task) => {
                const isOverlapping = overlapIds.has(task.id)
                const isCompleted = Boolean(task.completed)
                const repeats = isRepeatingTask(task)
                const Icon = getTaskIcon(task.icon)
                const endTime = getEndTime(task.start_time, task.duration || 0)

                return (
                  <div key={task.id} className="relative grid grid-cols-[4rem_minmax(0,1fr)_2.5rem] gap-4 items-start">
                    <div className={`pt-1 text-right text-sm font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {format(task.start_time ? parseISO(`${selectedDateStr}T${task.start_time}`) : selectedDate, 'H:mm')}
                    </div>

                    <button
                      onClick={() => setEditingTask(task)}
                      className={`min-w-0 text-left rounded-2xl px-4 py-3 border transition-all cursor-pointer
                        ${isCompleted ? 'opacity-55' : ''}
                        ${theme === 'dark'
                          ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]'
                          : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${task.color || '#a78bfa'}26` }}
                        >
                          <Icon size={19} style={{ color: task.color || 'var(--color-accent)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {formatTime12h(task.start_time)} - {formatTime12h(endTime)} ({formatDuration(task.duration || 0)})
                          </p>
                          <p className={`mt-1 text-base font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-gray-900'} ${(isOverlapping || isCompleted) ? 'line-through decoration-2 decoration-current/50' : ''}`}>
                            {task.title}
                          </p>
                          {repeats && (
                            <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                              <Repeat2 size={12} />
                              <span>{getRepeatLabel(task)}</span>
                            </p>
                          )}
                          {isOverlapping && (
                            <p className="mt-2 text-sm font-bold text-[#ff8f87]">
                              Tasks are overlapping
                            </p>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        onClick={() => onUpdateTask(task.id, { completed: !isCompleted })}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer
                          ${isCompleted
                            ? 'bg-accent text-white border-2 border-accent'
                            : theme === 'dark'
                              ? 'border-2 border-white/15 text-gray-500 hover:text-accent hover:border-accent/60 hover:bg-accent/10'
                              : 'border-2 border-gray-200 text-gray-300 hover:text-accent hover:border-accent/50 hover:bg-accent/10'}`}
                        title={isCompleted ? 'Mark task active' : 'Mark task complete'}
                      >
                        {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      </button>

                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer
                          ${theme === 'dark'
                            ? 'border-2 border-[#ff8f87] text-[#ff8f87] hover:bg-[#ff8f87]/10'
                            : 'border-2 border-red-300 text-red-400 hover:bg-red-50'}`}
                        title="Delete task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddTaskModal
          showDateField
          selectedDate={selectedDateStr}
          onClose={() => setShowModal(false)}
          onAdd={(task) => {
            onAddTask(task)
            if (task.date) setSelectedDateStr(task.date)
            setShowModal(false)
          }}
        />
      )}

      {editingTask && (
        <AddTaskModal
          mode="edit"
          initialTask={editingTask}
          selectedDate={editingTask.date || selectedDateStr}
          onClose={() => setEditingTask(null)}
          onAdd={(updates) => {
            handleUpdateTask(editingTask.id, updates)
            setEditingTask(null)
          }}
        />
      )}
    </div>
  )
}

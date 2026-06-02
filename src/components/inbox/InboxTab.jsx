import { useState } from 'react'
import { Inbox as InboxIcon, CheckCircle2 } from 'lucide-react'
import TaskInput from './TaskInput'
import TaskItem from './TaskItem'
import AddTaskModal from '../calendar/AddTaskModal'
import { useApp } from '../../context/AppContext'
import { formatDateISO } from '../../utils/dateUtils'

export default function InboxTab({ inboxTasks, onAddTask, onToggleTask, onDeleteTask, onScheduleTask }) {
  const { theme } = useApp()
  const [schedulingTask, setSchedulingTask] = useState(null)
  const pending = inboxTasks.filter(t => !t.completed)
  const completed = inboxTasks.filter(t => t.completed)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`px-6 py-5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Inbox
        </h1>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {pending.length} task{pending.length !== 1 ? 's' : ''} remaining
        </p>
      </div>

      {/* Task input */}
      <div className="px-6 pt-4">
        <TaskInput onAdd={onAddTask} />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-6 pt-3 pb-24 md:pb-8 space-y-1">
        {pending.length === 0 && completed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 opacity-40">
            <InboxIcon size={40} className="mb-3" />
            <p className="text-sm">Your inbox is empty</p>
          </div>
        )}

        {pending.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => onToggleTask(task.id)}
            onDelete={() => onDeleteTask(task.id)}
            onSchedule={() => setSchedulingTask(task)}
          />
        ))}

        {completed.length > 0 && (
          <>
            <div className="flex items-center gap-2 pt-4 pb-2">
              <CheckCircle2 size={14} className="text-accent opacity-60" />
              <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                Completed ({completed.length})
              </span>
            </div>
            {completed.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => onToggleTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
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

import { Trash2, Circle, CheckCircle2, CalendarPlus } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function TaskItem({ task, onToggle, onDelete, onSchedule }) {
  const { theme } = useApp()
  const canSchedule = !task.completed && onSchedule

  function handleItemClick() {
    if (canSchedule) onSchedule()
  }

  function handleItemKeyDown(e) {
    if (!canSchedule) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSchedule()
    }
  }

  function handleActionClick(e, action) {
    e.stopPropagation()
    action()
  }

  return (
    <div
      onClick={handleItemClick}
      onKeyDown={handleItemKeyDown}
      role={canSchedule ? 'button' : undefined}
      tabIndex={canSchedule ? 0 : undefined}
      title={canSchedule ? 'Click to schedule task' : undefined}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl group transition-all duration-200 outline-none
      ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
      ${canSchedule ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/60' : ''}
      ${task.completed ? 'opacity-50' : ''}`}
    >
      {/* Checkbox */}
      <button onClick={(e) => handleActionClick(e, onToggle)} className="flex-shrink-0 cursor-pointer transition-transform active:scale-90">
        {task.completed ? (
          <CheckCircle2 size={22} className="text-accent" />
        ) : (
          <Circle size={22} className={theme === 'dark' ? 'text-gray-600' : 'text-gray-300'} />
        )}
      </button>

      {/* Task title */}
      <span className={`min-w-0 flex-1 text-sm ${task.completed ? 'line-through' : ''}
        ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
        {task.title}
      </span>

      {!task.completed && onSchedule && (
        <button
          onClick={(e) => handleActionClick(e, onSchedule)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                     hover:bg-accent/10 transition-all cursor-pointer flex-shrink-0"
          title="Schedule task"
        >
          <CalendarPlus size={14} className="text-accent" />
        </button>
      )}

      {/* Delete */}
      <button
        onClick={(e) => handleActionClick(e, onDelete)}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                   hover:bg-red-500/10 transition-all cursor-pointer flex-shrink-0"
      >
        <Trash2 size={14} className="text-red-400" />
      </button>
    </div>
  )
}

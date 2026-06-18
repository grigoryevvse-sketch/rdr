import { Trash2, Circle, CheckCircle2, CalendarPlus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../utils/i18n'

export default function TaskItem({ task, detail, badge, onToggle, onDelete, onSchedule, onEdit }) {
  const { theme, language } = useApp()
  const canSchedule = !task.completed && onSchedule
  const canEdit = !task.completed && onEdit && task.source === 'scheduled'

  function handleItemClick() {
    if (canSchedule) {
      onSchedule()
    } else if (canEdit) {
      onEdit()
    }
  }

  function handleItemKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (canSchedule) {
        onSchedule()
      } else if (canEdit) {
        onEdit()
      }
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
      role={(canSchedule || canEdit) ? 'button' : undefined}
      tabIndex={(canSchedule || canEdit) ? 0 : undefined}
      title={canSchedule ? t(language, 'inbox.clickToSchedule') : (canEdit ? (language === 'ru' ? 'Редактировать событие' : 'Edit event') : undefined)}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl group transition-all duration-200 outline-none
      ${theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'}
      ${(canSchedule || canEdit) ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-accent/60' : ''}
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
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`min-w-0 truncate text-sm ${task.completed ? 'line-through' : ''}
            ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            {task.title}
          </span>
          {badge && (
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold
              ${theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              {badge}
            </span>
          )}
        </div>
        {detail && (
          <p className={`mt-0.5 truncate text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            {detail}
          </p>
        )}
        {task.notes && (
          <p className={`mt-1 text-xs whitespace-pre-wrap line-clamp-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            {task.notes}
          </p>
        )}
      </div>

      {!task.completed && onSchedule && (
        <button
          onClick={(e) => handleActionClick(e, onSchedule)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                     hover:bg-accent/10 transition-all cursor-pointer flex-shrink-0"
          title={t(language, 'inbox.scheduleTask')}
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

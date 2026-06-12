import { useRef, useState } from 'react'
import { CheckCircle2, Circle, Repeat2, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { addDays, formatDateISO, formatTime12h, getEndTime, parseISO, timeToPixels } from '../../utils/dateUtils'
import { getRepeatLabel, isRepeatingTask } from '../../utils/repeatUtils'
import { useApp } from '../../context/AppContext'

const DAY_DRAG_WIDTH = 96
const MINUTES_PER_STEP = 15

function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60
  const clamped = Math.max(0, Math.min(minutesInDay - MINUTES_PER_STEP, totalMinutes))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export default function TaskBlock({ task, selectedDate, pixelsPerHour, timelineStartOffset = 0, onUpdate, onEdit, onDelete, currentUserId }) {
  const { language } = useApp()
  const [dragPreview, setDragPreview] = useState(null)
  const dragRef = useRef(null)

  const displayStartTime = dragPreview?.start_time || task.start_time
  const displayDate = dragPreview?.date || task.date || selectedDate
  const top = timelineStartOffset + timeToPixels(displayStartTime, pixelsPerHour)
  const height = Math.max((task.duration / 60) * pixelsPerHour, 36) // min 36px
  const endTime = getEndTime(displayStartTime, task.duration)
  const isCompleted = Boolean(task.completed)
  const repeats = isRepeatingTask(task)
  const repeatLabel = getRepeatLabel(task)
  const accentColor = 'var(--color-accent)'
  const accentSoft = 'var(--color-accent-light)'
  const accentIconBackground = 'color-mix(in srgb, var(--color-accent) 24%, transparent)'

  // Dynamically get the Lucide icon component
  const iconName = task.icon
    ? task.icon.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    : 'Circle'
  const IconComponent = LucideIcons[iconName] || LucideIcons.Circle

  function handlePointerDown(e) {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)

    const originalMinutes = timeToMinutes(task.start_time)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: task.start_time,
      startDate: task.date || selectedDate,
      originalMinutes,
      moved: false,
    }
  }

  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    const deltaX = e.clientX - drag.startX
    const deltaY = e.clientY - drag.startY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true
    if (!drag.moved) return

    const rawMinutes = drag.originalMinutes + (deltaY / pixelsPerHour) * 60
    const steppedMinutes = Math.round(rawMinutes / MINUTES_PER_STEP) * MINUTES_PER_STEP
    const dayOffset = Math.round(deltaX / DAY_DRAG_WIDTH)
    const nextDate = formatDateISO(addDays(parseISO(drag.startDate), dayOffset))

    setDragPreview({
      start_time: minutesToTime(steppedMinutes),
      date: nextDate,
    })
    drag.preview = {
      start_time: minutesToTime(steppedMinutes),
      date: nextDate,
    }
  }

  function handlePointerUp(e) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return

    e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null

    if (!drag.moved || !drag.preview) {
      setDragPreview(null)
      onEdit()
      return
    }

    const updates = {}
    if (drag.preview.start_time !== task.start_time) updates.start_time = drag.preview.start_time
    if (drag.preview.date !== (task.date || selectedDate)) updates.date = drag.preview.date
    setDragPreview(null)

    if (Object.keys(updates).length > 0) {
      onUpdate(updates)
    }
  }

  function handlePointerCancel() {
    dragRef.current = null
    setDragPreview(null)
  }

  return (
    <div
      data-task-block
      className="absolute left-16 right-2 rounded-xl px-3 py-2 flex items-center gap-2.5
                 group transition-all duration-200 hover:scale-[1.01] hover:shadow-lg cursor-grab active:cursor-grabbing touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        top,
        height,
        backgroundColor: accentSoft,
        borderLeft: `3px solid ${accentColor}`,
        opacity: isCompleted ? 0.58 : dragPreview ? 0.86 : 1,
      }}
      title="Drag to reschedule, or click to edit"
    >
      {/* Complete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onUpdate({ completed: !isCompleted })
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10 transition-all duration-150 flex-shrink-0 cursor-pointer"
        title={isCompleted ? 'Mark task active' : 'Mark task complete'}
      >
        {isCompleted ? (
          <CheckCircle2 size={16} className="text-white" />
        ) : (
          <Circle size={16} className="text-white/55" />
        )}
      </button>

      {/* Icon */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accentIconBackground }}
      >
        <IconComponent size={14} style={{ color: accentColor }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className={`text-sm font-semibold text-white truncate leading-tight ${isCompleted ? 'line-through decoration-2 decoration-white/70' : ''}`}>
          {task.title}
        </p>
        {height >= 50 && (
          <p className="text-xs mt-0.5 opacity-60 text-white">
            {formatTime12h(displayStartTime)} – {formatTime12h(endTime)}
            {displayDate !== (task.date || selectedDate) ? ` • ${displayDate}` : ''}
          </p>
        )}
        {repeats && height >= 72 && (
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-white/70">
            <Repeat2 size={11} />
            <span className="truncate">{repeatLabel}</span>
          </p>
        )}
        {task.shared_by_name && task.user_id !== currentUserId && height >= 60 && (
          <p className="text-[10px] mt-0.5 opacity-80 text-white truncate font-medium">
            {language === 'ru' ? `От: ${task.shared_by_name}` : `From: ${task.shared_by_name}`}
          </p>
        )}
      </div>

      {/* Delete button on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/10
                   transition-all duration-150 flex-shrink-0 cursor-pointer"
        title="Delete task"
      >
        <Trash2 size={14} className="text-gray-400" />
      </button>
    </div>
  )
}

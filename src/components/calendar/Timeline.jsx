import { useEffect, useRef, useState } from 'react'
import { generateHourSlots, timeToPixels, formatTime12h, getCurrentTime24 } from '../../utils/dateUtils'
import TaskBlock from './TaskBlock'
import { useApp } from '../../context/AppContext'

const PIXELS_PER_HOUR = 80
const MINUTES_PER_DAY = 24 * 60
const CLICK_TIME_STEP_MINUTES = 5
const HOUR_LINE_OFFSET = 10

function minutesToTime(totalMinutes) {
  const rounded = Math.round(totalMinutes / CLICK_TIME_STEP_MINUTES) * CLICK_TIME_STEP_MINUTES
  const clamped = Math.max(0, Math.min(MINUTES_PER_DAY - CLICK_TIME_STEP_MINUTES, rounded))
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export default function Timeline({ tasks, selectedDate, onUpdateTask, onEditTask, onDeleteTask, onCreateTaskAtTime }) {
  const containerRef = useRef(null)
  const didAutoScrollRef = useRef(false)
  const [nowPosition, setNowPosition] = useState(0)
  const hours = generateHourSlots()
  const { theme } = useApp()

  // Update "now" line position
  useEffect(() => {
    function updateNow() {
      setNowPosition(HOUR_LINE_OFFSET + timeToPixels(getCurrentTime24(), PIXELS_PER_HOUR))
    }
    updateNow()
    const interval = setInterval(updateNow, 60_000) // every minute
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to "now" on first load
  useEffect(() => {
    if (containerRef.current && nowPosition > 0 && !didAutoScrollRef.current) {
      didAutoScrollRef.current = true
      containerRef.current.scrollTo({
        top: Math.max(0, nowPosition - 200),
        behavior: 'smooth',
      })
    }
  }, [nowPosition])

  function handleTimelineClick(e) {
    if (!onCreateTaskAtTime || e.target.closest('[data-task-block]')) return

    const gridRect = e.currentTarget.getBoundingClientRect()
    const y = Math.max(0, Math.min(gridRect.height - 1, e.clientY - gridRect.top))
    const minutes = (Math.max(0, y - HOUR_LINE_OFFSET) / PIXELS_PER_HOUR) * 60
    onCreateTaskAtTime(minutesToTime(minutes))
  }

  return (
    <div ref={containerRef} className="safe-scroll-bottom relative overflow-y-auto h-full px-4">
      {/* Hour grid */}
      <div
        className="relative cursor-crosshair"
        onClick={handleTimelineClick}
        style={{ height: HOUR_LINE_OFFSET + PIXELS_PER_HOUR * 24 }}
      >
        {hours.map((hour, i) => (
          <div
            key={hour}
            className="absolute left-0 right-0 flex items-start"
            style={{ top: i * PIXELS_PER_HOUR }}
          >
            {/* Time label */}
            <span className={`w-14 text-xs font-medium flex-shrink-0 pt-0.5
              ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {formatTime12h(hour)}
            </span>
            {/* Divider line */}
            <div className={`flex-1 border-t mt-2.5
              ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`} />
          </div>
        ))}

        {/* Task blocks */}
        {tasks.map((task) => {
          if (!task || !task.start_time || typeof task.start_time !== 'string') {
            console.warn(`Skipping render for invalid task:`, task)
            return null
          }
          return (
            <TaskBlock
              key={task.id}
              task={task}
              selectedDate={selectedDate}
              pixelsPerHour={PIXELS_PER_HOUR}
              timelineStartOffset={HOUR_LINE_OFFSET}
              onUpdate={(updates) => onUpdateTask(task.id, updates)}
              onEdit={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
            />
          )
        })}

        {/* "Now" indicator line */}
        <div className="now-line" style={{ top: nowPosition }}>
          <div className="now-dot" />
        </div>
      </div>
    </div>
  )
}

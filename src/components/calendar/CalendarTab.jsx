import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Calendar, Grid, CalendarDays } from 'lucide-react'
import Timeline from './Timeline'
import AddTaskModal from './AddTaskModal'
import {
  formatDateISO,
  formatTime12h,
  parseISO,
  isToday,
  isSameDay,
  isSameMonth,
  addDays,
  subDays,
  getWeekDays,
  getMonthGridDays,
} from '../../utils/dateUtils'
import { useApp } from '../../context/AppContext'
import { format, addMonths, subMonths } from 'date-fns'
import { DATE_LOCALES, t } from '../../utils/i18n'

export default function CalendarTab({ scheduledTasks, onAddTask, onUpdateTask, onDeleteTask, initialDate }) {
  const [selectedDateStr, setSelectedDateStr] = useState(initialDate || formatDateISO(new Date()))
  const [currentMonth, setCurrentMonth] = useState(initialDate ? parseISO(initialDate) : new Date())
  const [isOverviewOpen, setIsOverviewOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [newTaskDraft, setNewTaskDraft] = useState(null)
  const [editingTask, setEditingTask] = useState(null)
  const { theme, language } = useApp()

  const selectedDate = parseISO(selectedDateStr)

  // Filter tasks for the selected date
  const dailyTasks = scheduledTasks.filter((task) => task.date === selectedDateStr)
  const tasksByDate = scheduledTasks.reduce((groups, task) => {
    if (!task?.date) return groups
    groups[task.date] = groups[task.date] || []
    groups[task.date].push(task)
    return groups
  }, {})

  Object.values(tasksByDate).forEach((tasks) => {
    tasks.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  })

  function selectDate(dateStr) {
    const date = parseISO(dateStr)
    setSelectedDateStr(dateStr)
    if (!isSameMonth(date, currentMonth)) {
      setCurrentMonth(date)
    }
  }

  function handlePrevWeek() {
    selectDate(formatDateISO(subDays(selectedDate, 7)))
  }

  function handleNextWeek() {
    selectDate(formatDateISO(addDays(selectedDate, 7)))
  }

  function handlePrevMonth() {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  function handleNextMonth() {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  function handlePrevMonthDay() {
    selectDate(formatDateISO(subMonths(selectedDate, 1)))
  }

  function handleNextMonthDay() {
    selectDate(formatDateISO(addMonths(selectedDate, 1)))
  }

  function handleToday() {
    selectDate(formatDateISO(new Date()))
    setIsOverviewOpen(false)
  }

  // Get week days centered around the selected date
  const weekDays = getWeekDays(selectedDate)

  // Get month grid days
  const monthGridDays = getMonthGridDays(currentMonth)

  // Render day names for calendar grid (Mon-Sun)
  const gridDayNames = language === 'ru'
    ? ['П', 'В', 'С', 'Ч', 'П', 'С', 'В']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`safe-header-compact px-6 border-b flex flex-col gap-3 min-h-0
        ${isOverviewOpen ? 'flex-1 pb-20 md:pb-4' : 'pb-4'}
        ${theme === 'dark' ? 'border-white/5 bg-[#0f0f15]' : 'border-gray-200 bg-white'}`}>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {isToday(selectedDate) ? t(language, 'common.today') : format(selectedDate, 'EEEE', { locale: DATE_LOCALES[language] })}
            </h1>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              {format(selectedDate, 'EEEE, MMMM d', { locale: DATE_LOCALES[language] })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Today button */}
            <button
              onClick={handleToday}
              className={`h-10 px-3 rounded-xl border transition-all cursor-pointer flex items-center gap-2
                ${isToday(selectedDate)
                  ? 'bg-accent/20 border-accent text-accent'
                  : theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
                    : 'bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-800'}`}
              title={t(language, 'calendar.openToday')}
            >
              <CalendarDays size={16} />
              <span className="text-xs font-semibold">{t(language, 'common.today')}</span>
            </button>

            {/* Toggle Calendar Overview */}
            <button
              onClick={() => setIsOverviewOpen(!isOverviewOpen)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center
                ${isOverviewOpen
                  ? 'bg-accent/20 border-accent text-accent'
                  : theme === 'dark'
                    ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                    : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700'}`}
              title={t(language, 'calendar.monthOverview')}
            >
              {isOverviewOpen ? <Calendar size={18} /> : <Grid size={18} />}
            </button>

            {/* Add task button */}
            <button
              onClick={() => {
                setNewTaskDraft(null)
                setShowModal(true)
              }}
              className="w-10 h-10 rounded-xl flex items-center justify-center
                         bg-accent text-white hover:opacity-90 active:scale-95
                         transition-all duration-150 cursor-pointer shadow-md"
              style={{ boxShadow: '0 4px 12px var(--color-accent-light)' }}
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Date Navigator & Week Strip or Month Grid */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOverviewOpen ? 'flex-1 min-h-0' : ''}`}>
          {isOverviewOpen ? (
            /* Month Calendar Grid Overview */
            <div className={`h-full p-3 sm:p-4 rounded-2xl border flex flex-col gap-2 sm:gap-3 animate-fade-in
              ${theme === 'dark' ? 'bg-[#161622] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
              
              {/* Month Navigation Row */}
              <div className="flex items-center justify-between px-1">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                  {format(currentMonth, 'MMMM yyyy', { locale: DATE_LOCALES[language] })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer
                      ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleToday}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer
                      ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                  >
                    {t(language, 'common.today')}
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer
                      ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Day Name Headers */}
              <div className="grid grid-cols-7 text-center gap-y-1">
                {gridDayNames.map((name, i) => (
                  <span key={i} className={`text-[10px] font-bold tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {name}
                  </span>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div
                className="flex-1 min-h-0 grid grid-cols-7 gap-y-2 gap-x-1 text-center"
                style={{ gridTemplateRows: `repeat(${Math.ceil(monthGridDays.length / 7)}, minmax(0, 1fr))` }}
              >
                {monthGridDays.map((day, i) => {
                  const dateStr = formatDateISO(day)
                  const isDaySelected = isSameDay(day, selectedDate)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const dayTasks = tasksByDate[dateStr] || []
                  const taskCount = dayTasks.length
                  
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        selectDate(dateStr)
                        setIsOverviewOpen(false)
                      }}
                      className={`relative h-full min-h-0 rounded-xl flex flex-col items-stretch justify-start overflow-hidden p-1 sm:p-1.5 transition-all cursor-pointer
                        ${isDaySelected
                          ? 'bg-accent text-white font-semibold shadow-md'
                          : isToday(day)
                            ? theme === 'dark'
                              ? 'bg-accent/10 border border-accent/30 text-accent font-semibold'
                              : 'bg-accent/10 border border-accent/20 text-accent font-semibold'
                            : isCurrentMonth
                              ? theme === 'dark' ? 'text-gray-200 hover:bg-white/5' : 'text-gray-700 hover:bg-gray-200/50'
                            : theme === 'dark' ? 'text-gray-600 hover:bg-white/5' : 'text-gray-300 hover:bg-gray-200/50'
                        }`}
                    >
                      <span className="text-xs leading-none text-center shrink-0">{format(day, 'd')}</span>
                      
                      {taskCount > 0 && (
                        <span
                          className={`absolute bottom-1 left-1/2 flex min-w-4 -translate-x-1/2 items-center justify-center rounded-full px-1.5 text-[9px] font-bold leading-4 lg:hidden
                            ${isDaySelected
                              ? 'bg-white/20 text-white'
                              : theme === 'dark'
                                ? 'bg-accent/20 text-accent'
                                : 'bg-accent/15 text-accent'}`}
                        >
                          {taskCount}
                        </span>
                      )}

                      {taskCount > 0 && (
                        <span className="mt-1 hidden min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-0.5 pb-0.5 lg:flex">
                          {dayTasks.map((task) => {
                            const isCompleted = Boolean(task.completed)

                            return (
                              <span
                                key={task.id}
                                className={`flex min-h-5 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm
                                  ${isDaySelected
                                    ? 'bg-white/20 text-white'
                                    : theme === 'dark'
                                      ? 'bg-white/[0.06] text-gray-200'
                                      : 'bg-white text-gray-700 border border-gray-200/70'}`}
                                style={{
                                  borderLeft: '2px solid var(--color-accent)',
                                }}
                                title={task.title}
                              >
                                <span className={`min-w-0 flex-1 truncate font-semibold ${isCompleted ? 'line-through opacity-60' : ''}`}>
                                  {task.title}
                                </span>
                                {task.start_time && (
                                  <span className={`shrink-0 text-[9px] font-medium ${isDaySelected ? 'text-white/75' : 'text-gray-500'}`}>
                                    {formatTime12h(task.start_time)}
                                  </span>
                                )}
                              </span>
                            )
                          })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Horizontal Week Strip View */
            <div className="flex flex-col gap-2">
              {/* Month Navigator for Week Strip */}
              <div className="flex items-center justify-between px-2">
                <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {format(selectedDate, 'MMMM yyyy', { locale: DATE_LOCALES[language] })}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handlePrevMonthDay}
                    className={`p-1 rounded-lg transition-colors cursor-pointer
                      ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-155 text-gray-600'}`}
                    title={language === 'ru' ? 'Предыдущий месяц' : 'Previous Month'}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={handleNextMonthDay}
                    className={`p-1 rounded-lg transition-colors cursor-pointer
                      ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-155 text-gray-600'}`}
                    title={language === 'ru' ? 'Следующий месяц' : 'Next Month'}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 justify-between">
                <button
                  onClick={handlePrevWeek}
                  className={`p-2 rounded-xl transition-colors cursor-pointer
                    ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  title={language === 'ru' ? 'Предыдущая неделя' : 'Previous Week'}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex-1 grid grid-cols-7 gap-1">
                  {weekDays.map((day, i) => {
                    const dateStr = formatDateISO(day)
                    const isDaySelected = isSameDay(day, selectedDate)
                    const isDayToday = isToday(day)
                    
                    return (
                      <button
                        key={i}
                        onClick={() => selectDate(dateStr)}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer
                          ${isDaySelected
                            ? 'bg-accent text-white font-semibold shadow-sm scale-105'
                            : isDayToday
                              ? theme === 'dark'
                                ? 'bg-accent/15 border border-accent/30 text-accent font-semibold'
                                : 'bg-accent/15 border border-accent/20 text-accent font-semibold'
                              : theme === 'dark'
                                ? 'hover:bg-white/5 text-gray-400 hover:text-gray-200'
                                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        <span className="text-[10px] font-bold opacity-60 leading-none">
                          {format(day, 'E', { locale: DATE_LOCALES[language] })[0]}
                        </span>
                        <span className="text-xs font-bold mt-1.5 leading-none">
                          {format(day, 'd')}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <button
                  onClick={handleNextWeek}
                  className={`p-2 rounded-xl transition-colors cursor-pointer
                    ${theme === 'dark' ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                  title={language === 'ru' ? 'Следующая неделя' : 'Next Week'}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {!isOverviewOpen && (
        <div className="flex-1 overflow-y-auto">
          <Timeline
            tasks={dailyTasks}
            selectedDate={selectedDateStr}
            onUpdateTask={(id, updates) => {
              onUpdateTask(id, updates)
              if (updates.date) selectDate(updates.date)
            }}
            onEditTask={setEditingTask}
            onDeleteTask={onDeleteTask}
            onCreateTaskAtTime={(startTime) => {
              setNewTaskDraft({
                date: selectedDateStr,
                start_time: startTime,
              })
              setShowModal(true)
            }}
          />
        </div>
      )}

      {/* Add Task Modal */}
      {showModal && (
        <AddTaskModal
          showDateField
          onClose={() => {
            setShowModal(false)
            setNewTaskDraft(null)
          }}
          initialTask={newTaskDraft}
          selectedDate={selectedDateStr}
          onAdd={(task) => {
            onAddTask(task)
            if (task.date) selectDate(task.date)
            setShowModal(false)
            setNewTaskDraft(null)
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
            onUpdateTask(editingTask.id, updates)
            if (updates.date) selectDate(updates.date)
            setEditingTask(null)
          }}
        />
      )}
    </div>
  )
}

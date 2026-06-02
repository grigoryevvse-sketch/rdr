import { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { AppProvider, useApp } from './context/AppContext'
import { useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { useNotificationScheduler } from './hooks/useNotifications'
import { TABS } from './utils/constants'

import LoginScreen from './components/auth/LoginScreen'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import CalendarTab from './components/calendar/CalendarTab'
import TimelineTab from './components/timeline/TimelineTab'
import InboxTab from './components/inbox/InboxTab'
import AITab from './components/ai/AITab'
import SettingsTab from './components/settings/SettingsTab'

function AppContent() {
  const {
    user,
    loading: authLoading,
    error: authError,
    isConfigured: isAuthConfigured,
    signInWithGoogle,
    signOut,
  } = useAuth()
  const [demoMode, setDemoMode] = useState(false)
  const [calendarFocusDate, setCalendarFocusDate] = useState(null)

  // Allow demo mode (no sign-in needed)
  const effectiveUser = useMemo(() => {
    return demoMode ? { id: 'demo', email: null, user_metadata: {} } : user
  }, [demoMode, user])
  const isLoggedIn = demoMode || !!user

  const {
    scheduledTasks, inboxTasks, loading: tasksLoading, error: tasksError,
    addScheduledTask, updateScheduledTask, deleteScheduledTask,
    addInboxTask, toggleInboxTask, deleteInboxTask, scheduleInboxTask,
  } = useTasks(effectiveUser)

  const { activeTab, theme, notificationSettings, setTab } = useApp()
  const notificationControls = useNotificationScheduler(scheduledTasks, notificationSettings)

  function handleSignIn(mode) {
    if (mode === 'demo') {
      setDemoMode(true)
    } else {
      signInWithGoogle()
    }
  }

  function handleSignOut() {
    setDemoMode(false)
    signOut()
  }

  function handleAddScheduledFromAI(task) {
    setCalendarFocusDate(task.date)
    addScheduledTask(task)
  }

  async function handleScheduleInboxTask(inboxTaskId, task) {
    await scheduleInboxTask(inboxTaskId, task)
    setCalendarFocusDate(task.date)
    setTab(TABS.CALENDAR)
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0d0d14]">
        <Loader2 size={32} className="text-accent animate-spin" />
      </div>
    )
  }

  // Login screen
  if (!isLoggedIn) {
    return (
      <LoginScreen
        onSignIn={handleSignIn}
        authError={authError}
        isAuthConfigured={isAuthConfigured}
      />
    )
  }

  // Render active tab
  function renderTab() {
    switch (activeTab) {
      case TABS.CALENDAR:
        return (
          <CalendarTab
            key={calendarFocusDate || 'calendar'}
            scheduledTasks={scheduledTasks}
            onAddTask={addScheduledTask}
            onUpdateTask={updateScheduledTask}
            onDeleteTask={deleteScheduledTask}
            initialDate={calendarFocusDate}
          />
        )
      case TABS.TIMELINE:
        return (
          <TimelineTab
            scheduledTasks={scheduledTasks}
            onAddTask={addScheduledTask}
            onUpdateTask={updateScheduledTask}
            onDeleteTask={deleteScheduledTask}
            initialDate={calendarFocusDate}
          />
        )
      case TABS.INBOX:
        return (
          <InboxTab
            inboxTasks={inboxTasks}
            onAddTask={addInboxTask}
            onToggleTask={toggleInboxTask}
            onDeleteTask={deleteInboxTask}
            onScheduleTask={handleScheduleInboxTask}
          />
        )
      case TABS.AI:
        return (
          <AITab
            onAddScheduled={handleAddScheduledFromAI}
            onAddInbox={addInboxTask}
          />
        )
      case TABS.SETTINGS:
        return (
          <SettingsTab
            user={effectiveUser}
            onSignOut={handleSignOut}
            notificationControls={notificationControls}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={`flex h-screen overflow-hidden
      ${theme === 'dark' ? 'bg-[#0d0d14]' : 'bg-[#f5f5f7]'}`}>
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden animate-fade-in">
        {tasksLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={24} className="text-accent animate-spin" />
          </div>
        ) : tasksError && !demoMode ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <div className={`max-w-md rounded-2xl border p-5 text-center
              ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Supabase sync is not ready
              </p>
              <p className={`mt-2 text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {tasksError}
              </p>
            </div>
          </div>
        ) : (
          renderTab()
        )}
      </main>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

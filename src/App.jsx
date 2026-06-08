import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AppProvider, useApp } from './context/AppContext'
import { isTelegramWebView, useAuth } from './hooks/useAuth'
import { useTasks } from './hooks/useTasks'
import { useNotificationScheduler, usePushSubscription } from './hooks/useNotifications'
import { isSupabaseConfigured, supabase } from './supabase'
import { TABS } from './utils/constants'

import ErrorBoundary from './components/ErrorBoundary'
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
    signInWithTelegram,
    connectGoogleAccount,
    signOut,
  } = useAuth()
  const [demoMode, setDemoMode] = useState(false)
  const [calendarFocusDate, setCalendarFocusDate] = useState(null)

  // Allow demo mode (no sign-in needed)
  const effectiveUser = useMemo(() => {
    return demoMode ? { id: 'demo', email: null, user_metadata: {} } : user
  }, [demoMode, user])
  const isLoggedIn = demoMode || !!user
  const inTelegramWebView = isTelegramWebView()

  const {
    scheduledTasks, inboxTasks, loading: tasksLoading, error: tasksError,
    addScheduledTask, updateScheduledTask, deleteScheduledTask,
    addInboxTask, toggleInboxTask, deleteInboxTask, scheduleInboxTask,
  } = useTasks(effectiveUser)

  const { activeTab, theme, language, notificationSettings, setTab, setLanguage, setNotificationSettings } = useApp()
  const canSyncNotificationSettings = Boolean(
    isSupabaseConfigured && supabase && effectiveUser?.id && effectiveUser.id !== 'demo'
  )
  const localizedNotificationSettings = useMemo(() => ({
    ...notificationSettings,
    language,
  }), [notificationSettings, language])
  const notificationControls = useNotificationScheduler(scheduledTasks, localizedNotificationSettings)
  const [serverSettingsLoadedUserId, setServerSettingsLoadedUserId] = useState(null)
  const serverSettingsLoaded = canSyncNotificationSettings && serverSettingsLoadedUserId === effectiveUser?.id
  const notificationSettingsRef = useRef(notificationSettings)

  usePushSubscription(effectiveUser, notificationSettings, notificationControls.permission)

  useEffect(() => {
    if (authLoading || isLoggedIn || inTelegramWebView) return

    const url = new URL(window.location.href)
    if (url.searchParams.get('external_google_auth') !== '1') return

    url.searchParams.delete('external_google_auth')
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`)
    signInWithGoogle({ forceOAuth: true })
  }, [authLoading, inTelegramWebView, isLoggedIn, signInWithGoogle])

  useEffect(() => {
    notificationSettingsRef.current = notificationSettings
  }, [notificationSettings])

  useEffect(() => {
    if (!canSyncNotificationSettings) return

    let cancelled = false
    const userId = effectiveUser.id

    async function loadNotificationSettings() {
      const { data } = await supabase
        .from('notification_settings')
        .select('browser_enabled,telegram_enabled,telegram_chat_id,default_moments,time_zone,language')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return

      if (data) {
        const localSettings = notificationSettingsRef.current
        const nextSettings = {
          enabled: Boolean(data.browser_enabled),
          telegramEnabled: Boolean(data.telegram_enabled),
          telegramChatId: data.telegram_chat_id || '',
        }

        if (Array.isArray(data.default_moments)) {
          nextSettings.defaultMoments = data.default_moments
        }

        if (data.language === 'ru' || data.language === 'en') {
          setLanguage(data.language)
        }

        if (
          localSettings.telegramEnabled &&
          localSettings.telegramChatId &&
          (!nextSettings.telegramEnabled || !nextSettings.telegramChatId)
        ) {
          nextSettings.telegramEnabled = true
          nextSettings.telegramChatId = localSettings.telegramChatId
        }

        setNotificationSettings(nextSettings)
      }

      setServerSettingsLoadedUserId(userId)
    }

    loadNotificationSettings().catch(() => {
      setServerSettingsLoadedUserId(userId)
    })

    return () => {
      cancelled = true
    }
  }, [canSyncNotificationSettings, effectiveUser?.id, setLanguage, setNotificationSettings])

  useEffect(() => {
    if (!canSyncNotificationSettings || !serverSettingsLoaded) return

    async function saveNotificationSettings() {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

      try {
        const { error } = await supabase
          .from('notification_settings')
          .upsert({
            user_id: effectiveUser.id,
            browser_enabled: Boolean(notificationSettings.enabled),
            telegram_enabled: Boolean(notificationSettings.telegramEnabled && notificationSettings.telegramChatId),
            telegram_chat_id: notificationSettings.telegramChatId || null,
            default_moments: notificationSettings.defaultMoments,
            language,
            time_zone: timeZone,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

        if (error) {
          console.error('Notification settings sync error:', error)
        }
      } catch (error) {
        console.error('Notification settings sync error:', error)
      }
    }

    saveNotificationSettings()
  }, [canSyncNotificationSettings, effectiveUser?.id, language, notificationSettings, serverSettingsLoaded])

  function handleSignIn(mode) {
    if (mode === 'demo') {
      setDemoMode(true)
    } else if (inTelegramWebView) {
      signInWithTelegram()
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
      <div className="app-viewport flex items-center justify-center bg-[#0d0d14]">
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
        inTelegramWebView={inTelegramWebView}
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
            scheduledTasks={scheduledTasks}
            onAddTask={addInboxTask}
            onToggleTask={toggleInboxTask}
            onDeleteTask={deleteInboxTask}
            onScheduleTask={handleScheduleInboxTask}
            onToggleScheduledTask={updateScheduledTask}
            onDeleteScheduledTask={deleteScheduledTask}
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
            onConnectGoogle={connectGoogleAccount}
            notificationControls={notificationControls}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className={`app-viewport flex overflow-hidden
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
                {language === 'ru' ? 'Синхронизация Supabase не готова' : 'Supabase sync is not ready'}
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
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  )
}

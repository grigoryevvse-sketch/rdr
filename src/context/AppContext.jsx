/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { TABS, ACCENT_COLORS, DEFAULT_NOTIFICATION_MOMENTS } from '../utils/constants'

const NOTIFICATION_SETTINGS_KEY = 'planner-notification-settings'

function readStorageValue(key, fallback = null) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function writeStorageValue(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function loadNotificationSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIFICATION_SETTINGS_KEY))
    return {
      enabled: Boolean(saved?.enabled),
      defaultMoments: Array.isArray(saved?.defaultMoments)
        ? saved.defaultMoments
        : DEFAULT_NOTIFICATION_MOMENTS,
      telegramEnabled: Boolean(saved?.telegramEnabled),
      telegramChatId: typeof saved?.telegramChatId === 'string' ? saved.telegramChatId : '',
    }
  } catch {
    return {
      enabled: false,
      defaultMoments: DEFAULT_NOTIFICATION_MOMENTS,
      telegramEnabled: false,
      telegramChatId: '',
    }
  }
}

// ─── Initial State ───
function getInitialState() {
  return {
    activeTab: TABS.CALENDAR,
    theme: readStorageValue('planner-theme', 'dark'),
    accentColor: readStorageValue('planner-accent', ACCENT_COLORS[0].hex),
    notificationSettings: loadNotificationSettings(),
  }
}

// ─── Actions ───
const ACTIONS = {
  SET_TAB: 'SET_TAB',
  SET_THEME: 'SET_THEME',
  SET_ACCENT: 'SET_ACCENT',
  SET_NOTIFICATION_SETTINGS: 'SET_NOTIFICATION_SETTINGS',
}

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_TAB:
      return { ...state, activeTab: action.payload }
    case ACTIONS.SET_THEME:
      return { ...state, theme: action.payload }
    case ACTIONS.SET_ACCENT:
      return { ...state, accentColor: action.payload }
    case ACTIONS.SET_NOTIFICATION_SETTINGS:
      return {
        ...state,
        notificationSettings: {
          ...state.notificationSettings,
          ...action.payload,
        },
      }
    default:
      return state
  }
}

// ─── Context ───
const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  // Persist theme & accent to localStorage
  useEffect(() => {
    writeStorageValue('planner-theme', state.theme)
    // Apply dark/light class to <html>
    if (state.theme === 'dark') {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
    }
  }, [state.theme])

  useEffect(() => {
    writeStorageValue('planner-accent', state.accentColor)
    document.documentElement.style.setProperty('--color-accent', state.accentColor)
    // Create a lighter version for backgrounds
    document.documentElement.style.setProperty(
      '--color-accent-light',
      state.accentColor + '22'
    )
  }, [state.accentColor])

  useEffect(() => {
    writeStorageValue(NOTIFICATION_SETTINGS_KEY, JSON.stringify(state.notificationSettings))
  }, [state.notificationSettings])

  const setTab = useCallback((tab) => dispatch({ type: ACTIONS.SET_TAB, payload: tab }), [])
  const setTheme = useCallback((theme) => dispatch({ type: ACTIONS.SET_THEME, payload: theme }), [])
  const setAccent = useCallback((color) => dispatch({ type: ACTIONS.SET_ACCENT, payload: color }), [])
  const setNotificationSettings = useCallback((settings) => {
    dispatch({ type: ACTIONS.SET_NOTIFICATION_SETTINGS, payload: settings })
  }, [])
  const value = useMemo(() => ({
    ...state,
    setTab,
    setTheme,
    setAccent,
    setNotificationSettings,
  }), [state, setTab, setTheme, setAccent, setNotificationSettings])

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

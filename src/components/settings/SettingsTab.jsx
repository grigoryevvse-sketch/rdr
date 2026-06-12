import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing, Check, Languages, Link, Loader2, LogOut, Monitor, Palette, Plus, Send, Smartphone, Trash2, User } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import AccentPicker from './AccentPicker'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../supabase'
import { DEFAULT_NOTIFICATION_MOMENTS, NOTIFICATION_MOMENTS } from '../../utils/constants'
import { sendTelegramReminder } from '../../utils/telegramUtils'
import {
  addCustomNotificationMoment,
  customReminderToMinutes,
  CUSTOM_NOTIFICATION_UNITS,
  formatMinutesBefore,
  getCustomNotificationMinutesList,
  removeCustomNotificationMoment,
  splitCustomReminderMinutes,
  updateCustomNotificationMoment,
} from '../../utils/notificationUtils'
import { LANGUAGES, t } from '../../utils/i18n'

const MOMENT_LABELS_RU = {
  start: 'В начале',
  before10: 'За 10 мин',
  before60: 'За 1 час',
  before1day: 'За 1 день',
  before2days: 'За 2 дня',
  before1week: 'За 1 неделю',
  before1month: 'За 1 месяц',
  finish: 'Когда закончится',
}

const UNIT_LABELS_RU = {
  minutes: 'минут',
  hours: 'часов',
  days: 'дней',
  weeks: 'недель',
  months: 'месяцев',
}

export default function SettingsTab({ user, onSignOut, onConnectGoogle, notificationControls }) {
  const { theme, language, setLanguage, notificationSettings, setNotificationSettings } = useApp()
  const { permission = 'default', supported = false, requestPermission } = notificationControls || {}
  const [telegramTestStatus, setTelegramTestStatus] = useState('idle')
  const [googleConnectStatus, setGoogleConnectStatus] = useState('idle')
  const [googleConnectError, setGoogleConnectError] = useState('')
  const [newCustomReminderValue, setNewCustomReminderValue] = useState(30)
  const [newCustomReminderUnit, setNewCustomReminderUnit] = useState('minutes')
  
  // Custom username handle state
  const [usernameInput, setUsernameInput] = useState(notificationSettings.username || '')
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)

  const isDemo = !user || user.id === 'demo'

  useEffect(() => {
    if (notificationSettings.username !== undefined) {
      setUsernameInput(notificationSettings.username || '')
    }
  }, [notificationSettings.username])

  async function saveUsername() {
    const nextUsername = usernameInput.trim().toLowerCase().replace(/^@/, '')
    
    if (!nextUsername) {
      setUsernameError(language === 'ru' ? 'Имя пользователя не может быть пустым' : 'Username cannot be empty')
      return
    }

    if (nextUsername.length < 3) {
      setUsernameError(language === 'ru' ? 'Минимум 3 символа' : 'Minimum 3 characters')
      return
    }

    setUsernameSaving(true)
    setUsernameError('')
    setUsernameSuccess(false)

    try {
      const { error: upsertError } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user?.task_owner_id || user?.id,
          username: nextUsername,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (upsertError) {
        if (upsertError.code === '23505') {
          throw new Error(language === 'ru' ? 'Это имя пользователя уже занято' : 'This username is already taken')
        }
        throw upsertError
      }

      setNotificationSettings({ username: nextUsername })
      setUsernameSuccess(true)
      setTimeout(() => setUsernameSuccess(false), 3000)
    } catch (err) {
      setUsernameError(err.message || (language === 'ru' ? 'Не удалось сохранить имя пользователя' : 'Failed to save username'))
    } finally {
      setUsernameSaving(false)
    }
  }
  const defaultMoments = notificationSettings.defaultMoments || DEFAULT_NOTIFICATION_MOMENTS
  const customReminderMinutes = getCustomNotificationMinutesList(defaultMoments)
  const notificationsOn = notificationSettings.enabled && permission === 'granted'
  const telegramChatId = notificationSettings.telegramChatId || ''
  const telegramOn = Boolean(notificationSettings.telegramEnabled && telegramChatId.trim())
  const providers = user?.app_metadata?.providers || []
  const isTelegramUser = user?.user_metadata?.provider === 'telegram' || String(user?.email || '').startsWith('telegram-')
  const googleConnected = Boolean(
    user?.google_connected ||
    providers.includes('google') ||
    user?.identities?.some((identity) => identity.provider === 'google')
  )
  const showGoogleConnect = Boolean(isTelegramUser && !googleConnected && onConnectGoogle)

  async function enableNotifications() {
    const result = await requestPermission?.()
    if (result === 'granted') {
      setNotificationSettings({ enabled: true })
    }
  }

  function toggleNotifications() {
    if (!supported) return
    if (permission === 'granted') {
      setNotificationSettings({ enabled: !notificationSettings.enabled })
    } else {
      enableNotifications()
    }
  }

  function toggleDefaultMoment(momentId) {
    const current = defaultMoments
    const next = current.includes(momentId)
      ? current.filter((id) => id !== momentId)
      : [...current, momentId]

    setNotificationSettings({ defaultMoments: next })
  }

  function addCustomDefaultMoment() {
    const minutes = customReminderToMinutes(newCustomReminderValue, newCustomReminderUnit)

    setNotificationSettings({
      defaultMoments: addCustomNotificationMoment(defaultMoments, minutes),
    })
    const reminder = splitCustomReminderMinutes(minutes)
    setNewCustomReminderValue(reminder.value)
    setNewCustomReminderUnit(reminder.unit)
  }

  function updateCustomDefaultReminder(oldMinutes, value, unit) {
    const minutes = customReminderToMinutes(value, unit)

    setNotificationSettings({
      defaultMoments: updateCustomNotificationMoment(defaultMoments, oldMinutes, minutes),
    })
  }

  function removeCustomDefaultMoment(minutes) {
    setNotificationSettings({
      defaultMoments: removeCustomNotificationMoment(defaultMoments, minutes),
    })
  }

  function updateTelegramChatId(value) {
    const chatId = value.replace(/[^\d-]/g, '')
    setNotificationSettings({
      telegramChatId: chatId,
      telegramEnabled: notificationSettings.telegramEnabled && Boolean(chatId.trim()),
    })
  }

  function toggleTelegramNotifications() {
    setNotificationSettings({
      telegramEnabled: !telegramOn && Boolean(telegramChatId.trim()),
    })
  }

  async function sendTelegramTest() {
    if (!telegramChatId.trim()) return

    setTelegramTestStatus('sending')
    const sent = await sendTelegramReminder(
      language === 'ru'
        ? 'Тестовое напоминание из Reminder: Telegram-уведомления работают.'
        : 'Test reminder from Reminder: Telegram notifications are working.',
      telegramChatId.trim()
    )
    setTelegramTestStatus(sent ? 'sent' : 'failed')
  }

  async function connectGoogle() {
    if (!onConnectGoogle || googleConnectStatus === 'connecting') return

    setGoogleConnectStatus('connecting')
    setGoogleConnectError('')

    const result = await onConnectGoogle()

    if (result?.error) {
      setGoogleConnectError(result.error.message || t(language, 'settings.googleConnectFailed'))
      setGoogleConnectStatus('failed')
      return
    }

    setGoogleConnectStatus('idle')
  }

  function permissionLabel() {
    if (!supported) return t(language, 'settings.permission.unsupported')
    if (permission === 'granted' && notificationSettings.enabled) return t(language, 'settings.permission.grantedOn')
    if (permission === 'granted') return t(language, 'settings.permission.grantedPaused')
    if (permission === 'denied') return t(language, 'settings.permission.denied')
    return t(language, 'settings.permission.default')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`safe-header px-6 pb-5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {t(language, 'settings.title')}
        </h1>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {t(language, 'settings.subtitle')}
        </p>
      </div>

      <div className="safe-scroll-bottom flex-1 overflow-y-auto px-6 pt-6 space-y-6">
        {/* Account section */}
        {user && (
          <div className={`rounded-2xl p-4
            ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-accent" />
              <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t(language, 'settings.account')}
              </h2>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <span className="text-accent font-bold text-sm">
                      {(user.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {user.user_metadata?.full_name || user.email || t(language, 'settings.demoUser')}
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {user.email || t(language, 'settings.temporarySession')}
                  </p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                           text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                {t(language, 'settings.signOut')}
              </button>
            </div>

            {/* Custom username setting */}
            {!isDemo && (
              <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
                <label className={`text-xs font-medium mb-1.5 block ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {language === 'ru' ? 'Уникальное имя пользователя (для обмена задачами)' : 'Unique username handle (for sharing tasks)'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      @
                    </span>
                    <input
                      type="text"
                      value={usernameInput}
                      onChange={(e) => {
                        setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                        setUsernameError('')
                        setUsernameSuccess(false)
                      }}
                      placeholder="username"
                      className={`w-full pl-7 pr-3 py-2 rounded-xl text-sm outline-none
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:border-accent'
                          : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-accent'}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveUsername}
                    disabled={usernameSaving || usernameInput.trim().toLowerCase().replace(/^@/, '') === (notificationSettings.username || '')}
                    className="px-4 rounded-xl bg-accent text-white text-xs font-semibold hover:opacity-90 active:scale-95 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
                  >
                    {usernameSaving ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      language === 'ru' ? 'Сохранить' : 'Save'
                    )}
                  </button>
                </div>
                {usernameError && (
                  <p className="mt-1.5 text-xs text-red-400 leading-relaxed">
                    {usernameError}
                  </p>
                )}
                {usernameSuccess && (
                  <p className="mt-1.5 text-xs text-accent leading-relaxed">
                    {language === 'ru' ? 'Имя пользователя успешно обновлено!' : 'Username successfully updated!'}
                  </p>
                )}
              </div>
            )}

            {showGoogleConnect ? (
              <div className={`mt-4 rounded-2xl p-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {t(language, 'settings.googleConnect')}
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      {t(language, 'settings.googleConnectHelp')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={connectGoogle}
                    disabled={googleConnectStatus === 'connecting'}
                    className={`h-9 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold transition cursor-pointer shrink-0
                      disabled:cursor-not-allowed disabled:opacity-60
                      ${theme === 'dark'
                        ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {googleConnectStatus === 'connecting' ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                    {googleConnectStatus === 'connecting' ? t(language, 'settings.connecting') : t(language, 'settings.connect')}
                  </button>
                </div>
                {googleConnectError ? (
                  <p className="mt-3 text-xs leading-relaxed text-red-400">
                    {googleConnectError}
                  </p>
                ) : null}
              </div>
            ) : googleConnected ? (
              <div className={`mt-4 rounded-2xl p-3 flex items-center gap-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <span className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <Check size={15} />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {t(language, 'settings.googleConnected')}
                  </p>
                  <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                    {t(language, 'settings.googleConnectedHelp')}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Appearance */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={16} className="text-accent" />
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t(language, 'settings.appearance')}
            </h2>
          </div>
          <ThemeToggle />
        </div>

        {/* Language */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Languages size={16} className="text-accent" />
            <div>
              <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {t(language, 'settings.language')}
              </h2>
              <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {t(language, 'settings.languageHelp')}
              </p>
            </div>
          </div>
          <div className={`grid grid-cols-2 rounded-xl border p-1 text-xs font-semibold
            ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
            {LANGUAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLanguage(option.id)}
                className={`rounded-lg px-3 py-2 transition cursor-pointer
                  ${language === option.id
                    ? 'bg-accent text-white shadow-sm'
                    : theme === 'dark'
                      ? 'text-gray-400 hover:text-white'
                      : 'text-gray-500 hover:text-gray-800'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing size={16} className="text-accent shrink-0" />
              <div className="min-w-0">
                <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t(language, 'settings.notifications')}
                </h2>
                <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                  {permissionLabel()}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleNotifications}
              disabled={!supported || permission === 'denied'}
              className={`h-10 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
                ${notificationsOn
                  ? 'bg-accent text-white'
                  : theme === 'dark'
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'}`}
            >
              {notificationsOn ? <Bell size={14} /> : <BellOff size={14} />}
              {notificationsOn ? t(language, 'common.on') : t(language, 'common.enable')}
            </button>
          </div>

          <div className={`rounded-2xl p-3 mb-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                <Smartphone size={16} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {t(language, 'settings.currentDevice')}
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  {t(language, 'settings.currentDeviceHelp')}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl p-3 mb-4 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                <Send size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {t(language, 'settings.telegram')}
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      {t(language, 'settings.telegramHelp')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTelegramNotifications}
                    disabled={!telegramChatId.trim()}
                    className={`h-9 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
                      ${telegramOn
                        ? 'bg-accent text-white'
                        : theme === 'dark'
                          ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    {telegramOn ? <Bell size={14} /> : <BellOff size={14} />}
                    {telegramOn ? t(language, 'common.on') : t(language, 'common.off')}
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={telegramChatId}
                  onChange={(event) => updateTelegramChatId(event.target.value)}
                  placeholder={t(language, 'settings.chatId')}
                  className={`mt-3 w-full px-3 py-2.5 rounded-xl text-sm outline-none
                    ${theme === 'dark'
                      ? 'bg-white/5 border border-white/10 text-white placeholder:text-gray-600 focus:border-accent'
                      : 'bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-accent'}`}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className={`text-xs ${telegramTestStatus === 'failed'
                    ? 'text-red-400'
                    : telegramTestStatus === 'sent'
                      ? 'text-accent'
                      : theme === 'dark'
                        ? 'text-gray-500'
                        : 'text-gray-400'}`}
                  >
                    {telegramTestStatus === 'sending' && t(language, 'settings.testSending')}
                    {telegramTestStatus === 'sent' && t(language, 'settings.testSent')}
                    {telegramTestStatus === 'failed' && t(language, 'settings.testFailed')}
                    {telegramTestStatus === 'idle' && t(language, 'settings.testIdle')}
                  </p>
                  <button
                    type="button"
                    onClick={sendTelegramTest}
                    disabled={!telegramChatId.trim() || telegramTestStatus === 'sending'}
                    className={`h-9 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50
                      ${theme === 'dark'
                        ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                  >
                    <Send size={14} />
                    {t(language, 'settings.sendTest')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {t(language, 'settings.defaultReminders')}
              </p>
              <p className="text-xs font-semibold text-accent">
                {language === 'ru' ? `${defaultMoments.length} выбрано` : `${defaultMoments.length} selected`}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NOTIFICATION_MOMENTS.map((moment) => {
                const selected = defaultMoments.includes(moment.id)
                return (
                  <button
                    key={moment.id}
                    type="button"
                    onClick={() => toggleDefaultMoment(moment.id)}
                    className={`min-h-12 rounded-xl px-3 py-2 flex items-center gap-2 text-left transition cursor-pointer
                      ${selected
                        ? 'bg-accent/15 border border-accent/40 text-accent'
                        : theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                          : 'bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                  >
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-accent text-white' : theme === 'dark' ? 'bg-white/5' : 'bg-white'}`}>
                      {selected && <Check size={14} />}
                    </span>
                    <span className="text-xs font-semibold">{language === 'ru' ? MOMENT_LABELS_RU[moment.id] || moment.label : moment.label}</span>
                  </button>
                )
              })}

              <div className={`rounded-xl border sm:col-span-2 p-3 transition
                ${customReminderMinutes.length
                  ? 'bg-accent/10 border-accent/30'
                  : theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${customReminderMinutes.length ? 'text-accent' : theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {language === 'ru' ? 'Свои напоминания' : 'Custom reminders'}
                    </p>
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {language === 'ru' ? 'Добавь уведомления до начала новых задач.' : 'Add alerts before new tasks start.'}
                    </p>
                  </div>
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0
                    ${customReminderMinutes.length ? 'bg-accent text-white' : theme === 'dark' ? 'bg-white/5 text-gray-400' : 'bg-white text-gray-400'}`}
                  >
                    {customReminderMinutes.length ? <Check size={14} /> : <Bell size={14} />}
                  </span>
                </div>

                <div className="space-y-2">
                  {customReminderMinutes.map((minutes) => {
                    const reminder = splitCustomReminderMinutes(minutes)
                    return (
                    <div key={`custom-${minutes}`} className="grid grid-cols-[minmax(0,1fr)_7.25rem_auto] gap-2 items-center animate-fade-in">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={reminder.value}
                        onChange={(e) => updateCustomDefaultReminder(minutes, e.target.value, reminder.unit)}
                        aria-label={`Custom reminder ${formatMinutesBefore(minutes)}`}
                        className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none
                          ${theme === 'dark'
                            ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                            : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                      />
                      <select
                        value={reminder.unit}
                        onChange={(e) => updateCustomDefaultReminder(minutes, reminder.value, e.target.value)}
                        aria-label={`Custom reminder unit for ${formatMinutesBefore(minutes)}`}
                        className={`w-full px-2 py-2.5 rounded-xl text-sm outline-none cursor-pointer
                          ${theme === 'dark'
                            ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                            : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                      >
                        {CUSTOM_NOTIFICATION_UNITS.map((unit) => (
                          <option key={unit.value} value={unit.value}>{language === 'ru' ? UNIT_LABELS_RU[unit.value] || unit.label : unit.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCustomDefaultMoment(minutes)}
                        aria-label={`Remove ${formatMinutesBefore(minutes)}`}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition cursor-pointer
                          ${theme === 'dark'
                            ? 'bg-white/5 text-gray-400 hover:bg-red-500/10 hover:text-red-300 border border-white/10'
                            : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-200'}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    )
                  })}

                  <div className="grid grid-cols-[minmax(0,1fr)_7.25rem_auto] gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={newCustomReminderValue}
                      onChange={(e) => setNewCustomReminderValue(Math.max(1, Number(e.target.value) || 1))}
                      aria-label={language === 'ru' ? 'Новое своё напоминание' : 'New custom reminder amount'}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                          : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                    />
                    <select
                      value={newCustomReminderUnit}
                      onChange={(e) => setNewCustomReminderUnit(e.target.value)}
                      aria-label={language === 'ru' ? 'Единица нового напоминания' : 'New custom reminder unit'}
                      className={`w-full px-2 py-2.5 rounded-xl text-sm outline-none cursor-pointer
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                          : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                    >
                      {CUSTOM_NOTIFICATION_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>{language === 'ru' ? UNIT_LABELS_RU[unit.value] || unit.label : unit.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCustomDefaultMoment}
                      className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      aria-label={language === 'ru' ? 'Добавить своё напоминание' : 'Add custom reminder'}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {permission === 'denied' && (
            <p className={`text-xs mt-3 leading-relaxed ${theme === 'dark' ? 'text-amber-300' : 'text-amber-700'}`}>
              {language === 'ru'
                ? 'Уведомления заблокированы. Открой настройки браузера или системы, чтобы разрешить их для приложения.'
                : 'Notifications are blocked. Open your browser or system notification settings to allow this app.'}
            </p>
          )}
        </div>

        {/* Accent Color */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-accent" />
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {t(language, 'settings.accentColor')}
            </h2>
          </div>
          <AccentPicker />
        </div>

        {/* App info */}
        <div className="text-center pt-4">
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
            {t(language, 'settings.version')}
          </p>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`}>
            {t(language, 'settings.builtWith')}
          </p>
        </div>
      </div>
    </div>
  )
}

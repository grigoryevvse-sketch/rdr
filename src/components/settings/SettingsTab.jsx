import { useState } from 'react'
import { Bell, BellOff, BellRing, Check, LogOut, Monitor, Palette, Plus, Send, Smartphone, Trash2, User } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import AccentPicker from './AccentPicker'
import { useApp } from '../../context/AppContext'
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

export default function SettingsTab({ user, onSignOut, notificationControls }) {
  const { theme, notificationSettings, setNotificationSettings } = useApp()
  const { permission = 'default', supported = false, requestPermission } = notificationControls || {}
  const [telegramTestStatus, setTelegramTestStatus] = useState('idle')
  const [newCustomReminderValue, setNewCustomReminderValue] = useState(30)
  const [newCustomReminderUnit, setNewCustomReminderUnit] = useState('minutes')
  const defaultMoments = notificationSettings.defaultMoments || DEFAULT_NOTIFICATION_MOMENTS
  const customReminderMinutes = getCustomNotificationMinutesList(defaultMoments)
  const notificationsOn = notificationSettings.enabled && permission === 'granted'
  const telegramChatId = notificationSettings.telegramChatId || ''
  const telegramOn = Boolean(notificationSettings.telegramEnabled && telegramChatId.trim())

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
      'Test reminder from Reminder: Telegram notifications are working.',
      telegramChatId.trim()
    )
    setTelegramTestStatus(sent ? 'sent' : 'failed')
  }

  function permissionLabel() {
    if (!supported) return 'Not supported in this browser'
    if (permission === 'granted' && notificationSettings.enabled) return 'On for this device'
    if (permission === 'granted') return 'Allowed, currently paused'
    if (permission === 'denied') return 'Blocked in browser settings'
    return 'Needs permission'
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`safe-header px-6 pb-5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
        <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Settings
        </h1>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Customize your experience
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
                Account
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
                    {user.user_metadata?.full_name || user.email || 'Demo User'}
                  </p>
                  <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {user.email || 'Temporary demo'}
                  </p>
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                           text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Appearance */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Monitor size={16} className="text-accent" />
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Appearance
            </h2>
          </div>
          <ThemeToggle />
        </div>

        {/* Notifications */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing size={16} className="text-accent shrink-0" />
              <div className="min-w-0">
                <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Notifications
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
              {notificationsOn ? 'On' : 'Enable'}
            </button>
          </div>

          <div className={`rounded-2xl p-3 mb-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <div className="flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/5 text-gray-300' : 'bg-white text-gray-600 border border-gray-200'}`}>
                <Smartphone size={16} />
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Current device
                </p>
                <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                  Turn this on separately on each Mac, iPhone, iPad, or Android device where you want alerts.
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
                      Telegram
                    </p>
                    <p className={`text-xs mt-1 leading-relaxed ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                      Enter your Current chat ID after pressing Start in the bot.
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
                    {telegramOn ? 'On' : 'Off'}
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={telegramChatId}
                  onChange={(event) => updateTelegramChatId(event.target.value)}
                  placeholder="Your chat ID"
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
                    {telegramTestStatus === 'sending' && 'Sending test...'}
                    {telegramTestStatus === 'sent' && 'Test sent'}
                    {telegramTestStatus === 'failed' && 'Test failed'}
                    {telegramTestStatus === 'idle' && 'Use this to confirm your chat ID.'}
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
                    Test
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Default reminders for new tasks
              </p>
              <p className="text-xs font-semibold text-accent">
                {defaultMoments.length} selected
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
                    <span className="text-xs font-semibold">{moment.label}</span>
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
                      Custom reminders
                    </p>
                    <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      Add alerts before new tasks start.
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
                          <option key={unit.value} value={unit.value}>{unit.label}</option>
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
                      aria-label="New custom reminder amount"
                      className={`w-full px-3 py-2.5 rounded-xl text-sm outline-none
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                          : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                    />
                    <select
                      value={newCustomReminderUnit}
                      onChange={(e) => setNewCustomReminderUnit(e.target.value)}
                      aria-label="New custom reminder unit"
                      className={`w-full px-2 py-2.5 rounded-xl text-sm outline-none cursor-pointer
                        ${theme === 'dark'
                          ? 'bg-white/5 border border-white/10 text-white focus:border-accent'
                          : 'bg-white border border-gray-200 text-gray-900 focus:border-accent'}`}
                    >
                      {CUSTOM_NOTIFICATION_UNITS.map((unit) => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCustomDefaultMoment}
                      className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center hover:opacity-90 transition cursor-pointer"
                      aria-label="Add custom reminder"
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
              Notifications are blocked. Open your browser or system notification settings to allow this app.
            </p>
          )}
        </div>

        {/* Accent Color */}
        <div className={`rounded-2xl p-4
          ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-accent" />
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Accent Color
            </h2>
          </div>
          <AccentPicker />
        </div>

        {/* App info */}
        <div className="text-center pt-4">
          <p className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
            Reminder · v1.0.0
          </p>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-700' : 'text-gray-300'}`}>
            Built with React + Supabase + Tailwind
          </p>
        </div>
      </div>
    </div>
  )
}

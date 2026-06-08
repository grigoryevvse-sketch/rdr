import { ru } from 'date-fns/locale'

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
]

export const DATE_LOCALES = {
  ru,
}

export const UI_TEXT = {
  en: {
    nav: {
      calendar: 'Calendar',
      timeline: 'Timeline',
      inbox: 'Inbox',
      ai: 'AI',
      settings: 'Settings',
    },
    common: {
      today: 'Today',
      tomorrow: 'Tomorrow',
      enable: 'Enable',
      on: 'On',
      off: 'Off',
      confirm: 'Confirm',
      task: 'Task',
      time: 'Time',
      repeat: 'Repeat',
      reminders: 'Reminders',
      defaultSuffix: ' (default)',
      minuteShort: 'min',
    },
    login: {
      subtitle: 'Smart Planner',
      description: 'Plan your day, remember what matters, and sync across all your devices.',
      google: 'Continue with Google',
      telegram: 'Continue with Telegram',
      telegramAuth: 'Telegram will sign you in securely without opening Google inside Telegram.',
      telegramExternal: 'Telegram blocks Google sign-in inside its built-in browser. This will open the secure Google sign-in in your browser.',
      setup: 'Add your Supabase URL and anon key in .env, then restart the app to enable Google sign-in.',
      demo: 'or try a temporary demo',
    },
    calendar: {
      newTask: 'New Task',
      editTask: 'Edit Task',
      taskName: 'Task name...',
      date: 'Date',
      startTime: 'Start Time',
      chooseFromList: 'Choose from list',
      enterExactTime: 'Enter exact time',
      endsAt: 'Ends at',
      repeatThisTask: 'Repeat this task',
      repeatHelp: 'Create the next one when this task is completed',
      repeatSchedule: 'Repeat schedule',
      duration: 'Duration',
      custom: 'Custom',
      icon: 'Icon',
      notifications: 'Notifications',
      notificationHelp: 'Choose when reminders should arrive for this task.',
      addTask: 'Add task',
      saveTask: 'Save task',
      noTasks: 'No tasks scheduled',
      tapToCreate: 'Tap the timeline to create one',
      monthOverview: 'Toggle Month Overview',
      openToday: 'Open Today',
    },
    timeline: {
      header: 'Timeline',
      today: 'Today',
      noTasks: 'No tasks for this day',
      addSome: 'Add tasks to build your timeline',
    },
    inbox: {
      title: 'Inbox',
      remaining: (count) => `${count} task${count !== 1 ? 's' : ''} remaining`,
      all: 'All',
      birthdays: 'Birthdays',
      completed: (count) => `Completed (${count})`,
      empty: 'Your inbox is empty',
      noTasks: 'No tasks yet',
      noBirthdays: 'No birthdays in your calendar',
      noBirthdaysHint: 'Add a task with "Birthday:" in the title on the calendar',
      scheduled: 'Scheduled',
      scheduleTask: 'Schedule task',
      clickToSchedule: 'Click to schedule task',
      chatDate: (date, time) => [date, time].filter(Boolean).join(' at '),
      birthdayIn: (days) => days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `In ${days} days`,
    },
    ai: {
      title: 'AI Scheduler',
      subtitle: "Tell me what you need to do, and I'll organize it for you",
      trySaying: 'Try saying:',
      examples: [
        'Schedule a dentist appointment tomorrow at 3 PM for 45 minutes',
        'Put buy groceries in my inbox',
        'Plan a team meeting at 10 AM for 1 hour',
        'Add call mom to my to-do list',
        'Schedule gym session at 7 AM for 1.5 hours',
      ],
      placeholder: 'e.g. Schedule a dentist appointment tomorrow at 3 PM for 45 minutes...',
      attachedImage: 'Attached image',
      removeImage: 'Remove image',
      attachImage: 'Attach image',
      plannedItems: (count) => `${count} planned items`,
      schedule: 'Schedule',
      addToInbox: 'Add to Inbox',
      removeSuggestion: 'Remove suggested event',
    },
    settings: {
      title: 'Settings',
      subtitle: 'Customize your planner',
      account: 'Account',
      demoUser: 'Demo User',
      temporarySession: 'Temporary session',
      googleConnect: 'Connect Google',
      googleConnectHelp: 'Use the same tasks when you sign in with Google outside Telegram.',
      googleConnected: 'Google connected',
      googleConnectedHelp: 'Telegram and Google sign-ins now open the same Reminder account.',
      connect: 'Connect',
      signOut: 'Sign out',
      appearance: 'Appearance',
      language: 'Language',
      languageHelp: 'Use the app and notifications in this language.',
      notifications: 'Notifications',
      currentDevice: 'Current device',
      currentDeviceHelp: 'Turn this on separately on each Mac, iPhone, iPad, or Android device where you want alerts.',
      telegram: 'Telegram',
      telegramHelp: 'Start @RemindNotifBot, then paste your chat ID below. You can find it in @Getmyid_bot.',
      chatId: 'Your chat ID',
      testIdle: 'Use this to confirm your chat ID.',
      testSending: 'Sending test...',
      testSent: 'Test sent',
      testFailed: 'Test failed',
      sendTest: 'Send test',
      defaultReminders: 'Default reminders',
      defaultRemindersHelp: 'These are applied to new tasks unless you change them in the task modal.',
      accentColor: 'Accent Color',
      version: 'Reminder v1.0',
      builtWith: 'Built with React + Supabase',
      permission: {
        unsupported: 'Browser notifications are not supported',
        denied: 'Notifications are blocked in this browser',
        grantedOn: 'Browser notifications are on',
        grantedPaused: 'Allowed, currently paused',
        default: 'Enable browser alerts for task reminders',
      },
    },
  },
  ru: {
    nav: {
      calendar: 'Календарь',
      timeline: 'Таймлайн',
      inbox: 'Инбокс',
      ai: 'AI',
      settings: 'Настройки',
    },
    common: {
      today: 'Сегодня',
      tomorrow: 'Завтра',
      enable: 'Включить',
      on: 'Вкл',
      off: 'Выкл',
      confirm: 'Подтвердить',
      task: 'Задача',
      time: 'Время',
      repeat: 'Повтор',
      reminders: 'Напоминания',
      defaultSuffix: ' (по умолчанию)',
      minuteShort: 'мин',
    },
    login: {
      subtitle: 'Умный планер',
      description: 'Планируй день, помни важное и синхронизируй задачи на всех устройствах.',
      google: 'Продолжить с Google',
      telegram: 'Продолжить с Telegram',
      telegramAuth: 'Telegram безопасно выполнит вход без открытия Google внутри Telegram.',
      telegramExternal: 'Telegram блокирует вход Google во встроенном браузере. Мы откроем безопасный вход Google в обычном браузере.',
      setup: 'Добавь Supabase URL и anon key в .env, затем перезапусти приложение, чтобы включить вход через Google.',
      demo: 'или открыть временное демо',
    },
    calendar: {
      newTask: 'Новая задача',
      editTask: 'Редактировать задачу',
      taskName: 'Название задачи...',
      date: 'Дата',
      startTime: 'Время начала',
      chooseFromList: 'Выбрать из списка',
      enterExactTime: 'Ввести точное время',
      endsAt: 'Закончится в',
      repeatThisTask: 'Повторять задачу',
      repeatHelp: 'Создать следующую, когда эта задача будет завершена',
      repeatSchedule: 'Расписание повтора',
      duration: 'Длительность',
      custom: 'Своё',
      icon: 'Иконка',
      notifications: 'Уведомления',
      notificationHelp: 'Выбери, когда должны приходить напоминания для этой задачи.',
      addTask: 'Добавить задачу',
      saveTask: 'Сохранить',
      noTasks: 'На этот день задач нет',
      tapToCreate: 'Нажми на таймлайн, чтобы создать задачу',
      monthOverview: 'Переключить обзор месяца',
      openToday: 'Открыть сегодня',
    },
    timeline: {
      header: 'Таймлайн',
      today: 'Сегодня',
      noTasks: 'На этот день задач нет',
      addSome: 'Добавь задачи, чтобы собрать таймлайн',
    },
    inbox: {
      title: 'Инбокс',
      remaining: (count) => `${count} ${pluralRu(count, 'задача', 'задачи', 'задач')} осталось`,
      all: 'Все',
      birthdays: 'Дни рождения',
      completed: (count) => `Завершено (${count})`,
      empty: 'Инбокс пуст',
      noTasks: 'Задач пока нет',
      noBirthdays: 'Дней рождений в календаре нет',
      noBirthdaysHint: 'Добавь задачу с «День рождения:» в названии в календарь',
      scheduled: 'Запланировано',
      scheduleTask: 'Запланировать задачу',
      clickToSchedule: 'Нажми, чтобы запланировать',
      chatDate: (date, time) => [date, time].filter(Boolean).join(' в '),
      birthdayIn: (days) => days === 0 ? 'Сегодня!' : days === 1 ? 'Завтра' : `Через ${days} ${pluralRu(days, 'день', 'дня', 'дней')}`,
    },
    ai: {
      title: 'AI-планировщик',
      subtitle: 'Напиши, что нужно сделать, а я разложу это по местам',
      trySaying: 'Попробуй написать:',
      examples: [
        'Запланируй стоматолога завтра в 15:00 на 45 минут',
        'Добавь купить продукты в инбокс',
        'Запланируй встречу команды в 10:00 на 1 час',
        'Добавь позвонить маме в список дел',
        'Запланируй тренировку в 7:00 на 1.5 часа',
      ],
      placeholder: 'Например: запланируй стоматолога завтра в 15:00 на 45 минут...',
      attachedImage: 'Изображение прикреплено',
      removeImage: 'Убрать изображение',
      attachImage: 'Прикрепить изображение',
      plannedItems: (count) => `${count} ${pluralRu(count, 'запланированный пункт', 'запланированных пункта', 'запланированных пунктов')}`,
      schedule: 'Запланировать',
      addToInbox: 'Добавить в инбокс',
      removeSuggestion: 'Удалить предложенное событие',
    },
    settings: {
      title: 'Настройки',
      subtitle: 'Настрой планер под себя',
      account: 'Аккаунт',
      demoUser: 'Демо-пользователь',
      temporarySession: 'Временная сессия',
      googleConnect: 'Подключить Google',
      googleConnectHelp: 'Используй те же задачи при входе через Google вне Telegram.',
      googleConnected: 'Google подключен',
      googleConnectedHelp: 'Вход через Telegram и Google теперь открывает один аккаунт Reminder.',
      connect: 'Подключить',
      signOut: 'Выйти',
      appearance: 'Внешний вид',
      language: 'Язык',
      languageHelp: 'Интерфейс и уведомления будут использовать этот язык.',
      notifications: 'Уведомления',
      currentDevice: 'Текущее устройство',
      currentDeviceHelp: 'Включи отдельно на каждом Mac, iPhone, iPad или Android-устройстве, где нужны уведомления.',
      telegram: 'Telegram',
      telegramHelp: 'Нажми Start в @RemindNotifBot, затем вставь ниже свой chat ID. Его можно узнать в @Getmyid_bot.',
      chatId: 'Твой chat ID',
      testIdle: 'Отправь тест, чтобы проверить chat ID.',
      testSending: 'Отправляю тест...',
      testSent: 'Тест отправлен',
      testFailed: 'Тест не отправился',
      sendTest: 'Тест',
      defaultReminders: 'Напоминания по умолчанию',
      defaultRemindersHelp: 'Они применяются к новым задачам, если не изменить их в окне задачи.',
      accentColor: 'Акцентный цвет',
      version: 'Reminder v1.0',
      builtWith: 'Сделано на React + Supabase',
      permission: {
        unsupported: 'Браузерные уведомления не поддерживаются',
        denied: 'Уведомления заблокированы в браузере',
        grantedOn: 'Браузерные уведомления включены',
        grantedPaused: 'Разрешены, но сейчас на паузе',
        default: 'Включи уведомления браузера для напоминаний',
      },
    },
  },
}

function pluralRu(count, one, few, many) {
  const mod10 = Math.abs(count) % 10
  const mod100 = Math.abs(count) % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function normalizeLanguage(language) {
  return language === 'ru' ? 'ru' : 'en'
}

export function t(language, path, ...args) {
  const safeLanguage = normalizeLanguage(language)
  const value = path.split('.').reduce((current, key) => current?.[key], UI_TEXT[safeLanguage])
    ?? path.split('.').reduce((current, key) => current?.[key], UI_TEXT.en)
    ?? path

  return typeof value === 'function' ? value(...args) : value
}

function leadTimeText(minutes, language = 'en') {
  const value = Number(minutes) || 0

  if (language === 'ru') {
    if (value < 60) return `${value} ${pluralRu(value, 'минуту', 'минуты', 'минут')}`
    if (value % 60 === 0) {
      const hours = value / 60
      return `${hours} ${pluralRu(hours, 'час', 'часа', 'часов')}`
    }
    const hours = Math.floor(value / 60)
    const rest = value % 60
    return `${hours} ч ${rest} мин`
  }

  if (value < 60) return `${value} ${value === 1 ? 'minute' : 'minutes'}`
  if (value % 60 === 0) {
    const hours = value / 60
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return `${hours} hr ${rest} min`
}

export function notificationTitle(momentId, task, language = 'en') {
  const title = task?.title || ''
  const safeLanguage = normalizeLanguage(language)

  if (momentId?.startsWith?.('custom:')) {
    const minutes = Number(momentId.split(':')[1]) || 0
    return safeLanguage === 'ru'
      ? `${title} начнётся через ${leadTimeText(minutes, safeLanguage)}`
      : `${title} starts in ${leadTimeText(minutes, safeLanguage)}`
  }

  const translations = {
    en: {
      before10: `${title} starts in 10 minutes`,
      before60: `${title} starts in 1 hour`,
      before1day: `${title} starts in 1 day`,
      before2days: `${title} starts in 2 days`,
      before1week: `${title} starts in 1 week`,
      before1month: `${title} starts in 1 month`,
      finish: `${title} is finished`,
      start: `${title} is starting`,
    },
    ru: {
      before10: `${title} начнётся через 10 минут`,
      before60: `${title} начнётся через 1 час`,
      before1day: `${title} начнётся через 1 день`,
      before2days: `${title} начнётся через 2 дня`,
      before1week: `${title} начнётся через 1 неделю`,
      before1month: `${title} начнётся через 1 месяц`,
      finish: `${title} завершена`,
      start: `${title} начинается`,
    },
  }

  return translations[safeLanguage][momentId] || translations[safeLanguage].start
}

export function notificationBody(momentId, language = 'en') {
  const safeLanguage = normalizeLanguage(language)
  if (safeLanguage === 'ru') {
    if (momentId === 'finish') return 'Запланированное время этой задачи закончилось.'
    if (momentId === 'start') return 'Пора начать эту задачу.'
    return 'Напоминание о предстоящей задаче.'
  }

  if (momentId === 'finish') return 'Your planned time for this task has ended.'
  if (momentId === 'start') return 'Time to begin this task.'
  return 'Upcoming task reminder.'
}

export function telegramNotificationText(momentId, task, language = 'en') {
  if (momentId === 'start') {
    return normalizeLanguage(language) === 'ru'
      ? `${task.title} начинается сейчас`
      : `${task.title} starts now`
  }
  return notificationTitle(momentId, task, language)
}

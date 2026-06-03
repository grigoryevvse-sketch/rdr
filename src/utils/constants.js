// ─── Tab identifiers ─── 
export const TABS = {
  CALENDAR: 'calendar',
  TIMELINE: 'timeline',
  INBOX: 'inbox',
  AI: 'ai',
  SETTINGS: 'settings',
}

// ─── Pastel accent color palette ───
export const ACCENT_COLORS = [
  { name: 'Lavender',  hex: '#a78bfa' },
  { name: 'Sky Blue',  hex: '#7dd3fc' },
  { name: 'Mint',      hex: '#6ee7b7' },
  { name: 'Peach',     hex: '#fca5a1' },
  { name: 'Blush',     hex: '#f9a8d4' },
  { name: 'Butter',    hex: '#fde68a' },
  { name: 'Lilac',     hex: '#c4b5fd' },
  { name: 'Sage',      hex: '#86efac' },
]

// ─── Task icon options (Lucide icon names) ───
export const TASK_ICONS = [
  'briefcase', 'book-open', 'coffee', 'dumbbell', 'heart',
  'music', 'phone', 'shopping-cart', 'stethoscope', 'users',
  'utensils', 'video', 'code', 'pen-tool', 'globe',
]

// ─── Task color options for calendar blocks ───
export const TASK_COLORS = [
  '#a78bfa', '#7dd3fc', '#6ee7b7', '#fca5a1',
  '#f9a8d4', '#fde68a', '#c4b5fd', '#86efac',
  '#fb923c', '#67e8f9',
]

export const NOTIFICATION_MOMENTS = [
  {
    id: 'start',
    label: 'At start',
    description: 'When the task begins',
  },
  {
    id: 'before10',
    label: '10 min before',
    description: 'A short heads-up before it starts',
  },
  {
    id: 'before60',
    label: '1 hour before',
    description: 'Enough time to prepare',
  },
  {
    id: 'before1day',
    label: '1 day before',
    description: 'A day-ahead reminder',
  },
  {
    id: 'before2days',
    label: '2 days before',
    description: 'A two-day heads-up',
  },
  {
    id: 'before1week',
    label: '1 week before',
    description: 'Plan ahead for bigger tasks',
  },
  {
    id: 'before1month',
    label: '1 month before',
    description: 'A long-range reminder',
  },
  {
    id: 'finish',
    label: 'When finished',
    description: 'When the scheduled time ends',
  },
]

export const DEFAULT_NOTIFICATION_MOMENTS = ['start']

// ─── Default sample tasks (first-run experience) ───
export const DEFAULT_SCHEDULED_TASKS = [
  {
    id: 'demo-1',
    title: 'Morning Workout',
    start_time: '07:00',
    duration: 60,
    color: '#6ee7b7',
    icon: 'dumbbell',
    completed: false,
  },
  {
    id: 'demo-2',
    title: 'Team Standup',
    start_time: '09:30',
    duration: 30,
    color: '#7dd3fc',
    icon: 'users',
    completed: false,
  },
  {
    id: 'demo-3',
    title: 'Deep Work: Coding',
    start_time: '10:30',
    duration: 120,
    color: '#a78bfa',
    icon: 'code',
    completed: false,
  },
  {
    id: 'demo-4',
    title: 'Lunch Break',
    start_time: '13:00',
    duration: 60,
    color: '#fde68a',
    icon: 'utensils',
    completed: false,
  },
  {
    id: 'demo-5',
    title: 'Read a Book',
    start_time: '18:00',
    duration: 45,
    color: '#f9a8d4',
    icon: 'book-open',
    completed: false,
  },
]

export const DEFAULT_INBOX_TASKS = [
  { id: 'inbox-1', title: 'Buy groceries', completed: false },
  { id: 'inbox-2', title: 'Reply to Sarah\'s email', completed: false },
  { id: 'inbox-3', title: 'Schedule dentist appointment', completed: true },
]

import { CalendarDays, Clock3, Inbox, Sparkles, Settings } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { TABS } from '../../utils/constants'

const navItems = [
  { id: TABS.CALENDAR, label: 'Calendar', Icon: CalendarDays },
  { id: TABS.TIMELINE, label: 'Timeline', Icon: Clock3 },
  { id: TABS.INBOX,    label: 'Inbox',    Icon: Inbox },
  { id: TABS.AI,       label: 'AI',       Icon: Sparkles },
  { id: TABS.SETTINGS, label: 'Settings', Icon: Settings },
]

export default function BottomNav() {
  const { activeTab, setTab, theme } = useApp()

  return (
    <nav className={`md:hidden flex items-center justify-around px-2 py-2 border-t
      ${theme === 'dark' ? 'bg-[#111118]/90 backdrop-blur-xl border-white/5' : 'bg-white/90 backdrop-blur-xl border-gray-200'}
      fixed bottom-0 left-0 right-0 z-50`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>
      {navItems.map(({ id, label, Icon }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl
                        transition-all duration-200 cursor-pointer
                        ${isActive
                          ? 'text-accent'
                          : theme === 'dark'
                            ? 'text-gray-500'
                            : 'text-gray-400'
                        }`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
            <span className={`text-[10px] font-medium ${isActive ? 'opacity-100' : 'opacity-60'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

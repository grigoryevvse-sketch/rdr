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

export default function Sidebar() {
  const { activeTab, setTab, theme } = useApp()

  return (
    <aside className={`hidden md:flex flex-col w-[72px] items-center py-6 gap-2 border-r
      ${theme === 'dark' ? 'bg-[#111118] border-white/5' : 'bg-white border-gray-200'}`}>
      {/* App icon */}
      <img src="/favicon.svg" alt="" className="w-10 h-10 rounded-xl mb-6 shadow-lg shadow-accent/20" />

      {/* Nav items */}
      {navItems.map(({ id, label, Icon }) => {
        const isActive = activeTab === id
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5
                        transition-all duration-200 cursor-pointer group relative
                        ${isActive
                          ? 'text-accent bg-accent/10'
                          : theme === 'dark'
                            ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                        }`}
            title={label}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        )
      })}
    </aside>
  )
}

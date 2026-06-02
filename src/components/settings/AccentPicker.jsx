import { Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { ACCENT_COLORS } from '../../utils/constants'

export default function AccentPicker() {
  const { accentColor, setAccent, theme } = useApp()

  return (
    <div className="grid grid-cols-4 gap-3">
      {ACCENT_COLORS.map(({ name, hex }) => {
        const isActive = accentColor === hex
        return (
          <button
            key={hex}
            onClick={() => setAccent(hex)}
            className="flex flex-col items-center gap-2 cursor-pointer group"
            title={name}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center
                          transition-all duration-200 group-hover:scale-110
                          ${isActive ? 'ring-2 ring-offset-2 scale-110' : ''}`}
              style={{
                backgroundColor: hex,
                ringColor: hex,
                ringOffsetColor: theme === 'dark' ? '#1a1a24' : '#ffffff',
              }}
            >
              {isActive && <Check size={16} className="text-white drop-shadow" />}
            </div>
            <span className={`text-[10px] font-medium
              ${isActive
                ? 'text-accent'
                : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

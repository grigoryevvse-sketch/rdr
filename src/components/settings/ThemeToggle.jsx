import { Sun, Moon } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function ThemeToggle() {
  const { theme, setTheme, language } = useApp()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {isDark
            ? (language === 'ru' ? 'Тёмная тема' : 'Dark Mode')
            : (language === 'ru' ? 'Светлая тема' : 'Light Mode')}
        </p>
        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          {isDark
            ? (language === 'ru' ? 'Мягче для глаз' : 'Easy on the eyes')
            : (language === 'ru' ? 'Ярко и чисто' : 'Bright and clear')}
        </p>
      </div>

      {/* Toggle switch */}
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={`relative w-14 h-8 rounded-full transition-all duration-300 cursor-pointer
          ${isDark ? 'bg-accent/30' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-1 w-6 h-6 rounded-full flex items-center justify-center
                         transition-all duration-300 shadow-md
                         ${isDark ? 'left-7 bg-accent' : 'left-1 bg-white'}`}>
          {isDark ? <Moon size={12} className="text-white" /> : <Sun size={12} className="text-amber-500" />}
        </div>
      </button>
    </div>
  )
}

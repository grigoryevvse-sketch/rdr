import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function TaskInput({ onAdd }) {
  const [value, setValue] = useState('')
  const { theme } = useApp()

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task... press Enter ↵"
        className={`flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-all
          ${theme === 'dark'
            ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-accent'
            : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-accent'}`}
      />
      <button
        type="submit"
        className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center
                   hover:opacity-90 active:scale-95 transition-all cursor-pointer flex-shrink-0"
      >
        <Plus size={18} strokeWidth={2.5} />
      </button>
    </form>
  )
}

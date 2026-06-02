import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'

export default function PromptInput({ onSubmit, isProcessing }) {
  const [value, setValue] = useState('')
  const { theme } = useApp()

  function handleSubmit(e) {
    e.preventDefault()
    if (!value.trim() || isProcessing) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
        placeholder="e.g. Schedule a dentist appointment tomorrow at 3 PM for 45 minutes..."
        rows={3}
        className={`w-full px-4 py-4 pr-14 rounded-2xl text-sm resize-none outline-none transition-all
          ${theme === 'dark'
            ? 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-accent focus:shadow-[0_0_20px_var(--color-accent-light)]'
            : 'bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-accent focus:shadow-[0_0_20px_var(--color-accent-light)]'}`}
      />
      <button
        type="submit"
        disabled={isProcessing || !value.trim()}
        className="absolute bottom-3 right-3 w-10 h-10 rounded-xl bg-accent text-white
                   flex items-center justify-center hover:opacity-90 active:scale-95
                   transition-all disabled:opacity-30 cursor-pointer"
      >
        {isProcessing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
      </button>
    </form>
  )
}

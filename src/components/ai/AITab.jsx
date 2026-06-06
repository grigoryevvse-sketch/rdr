import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import PromptInput from './PromptInput'
import ParseResult from './ParseResult'
import { parseTaskInput } from './mockParser'
import { useApp } from '../../context/AppContext'

const EXAMPLE_PROMPTS = [
  "Schedule a dentist appointment tomorrow at 3 PM for 45 minutes",
  "Put buy groceries in my inbox",
  "Plan a team meeting at 10 AM for 1 hour",
  "Add call mom to my to-do list",
  "Schedule gym session at 7 AM for 1.5 hours",
]

export default function AITab({ onAddScheduled, onAddInbox }) {
  const [result, setResult] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { accentColor, theme, setTab } = useApp()

  async function handleSubmit(text, image) {
    setIsProcessing(true)
    try {
      const parsed = await parseTaskInput(text, image)
      setResult(parsed)
    } catch (error) {
      console.error('AI Parsing Error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  function handleConfirm() {
    if (!result) return

    const items = result.intent === 'batch' && Array.isArray(result.items)
      ? result.items
      : [result]
    let addedScheduled = false
    let addedInbox = false

    items.forEach((item) => {
      if (item.intent === 'inbox') {
        onAddInbox(item.title)
        addedInbox = true
        return
      }

      onAddScheduled({
        title: item.title,
        start_time: item.time || '09:00', // Default to 9:00 AM if no time is provided
        duration: item.duration || 30,    // Default to 30 min duration
        color: accentColor,
        icon: 'sparkles',
        date: item.date,                  // Use the resolved ISO date string directly
        repeat_frequency: item.repeat_frequency || 'none',
        repeat_interval: 1,
        notification_moments: Array.isArray(item.notification_moments)
          ? item.notification_moments
          : undefined,
      })
      addedScheduled = true
    })

    if (addedScheduled) {
      setTab('calendar') // Switch to Calendar tab so the user sees the added tasks
    } else if (addedInbox) {
      setTab('inbox') // Switch to Inbox tab so the user sees the added tasks
    }
    setResult(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`safe-header px-6 pb-5 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-accent" />
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            AI Scheduler
          </h1>
        </div>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Tell me what you need to do, and I'll organize it for you
        </p>
      </div>

      <div className="safe-scroll-bottom flex-1 overflow-y-auto px-6 pt-6 space-y-6">
        {/* Prompt input */}
        <PromptInput onSubmit={handleSubmit} isProcessing={isProcessing} />

        {/* Example prompts */}
        <div>
          <p className={`text-xs font-medium mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            Try saying:
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(prompt)}
                className={`text-xs px-3 py-2 rounded-xl transition-all cursor-pointer
                  ${theme === 'dark'
                    ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <ParseResult result={result} onConfirm={handleConfirm} onDismiss={() => setResult(null)} />
        )}
      </div>
    </div>
  )
}

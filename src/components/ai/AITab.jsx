import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import AddTaskModal from '../calendar/AddTaskModal'
import PromptInput from './PromptInput'
import ParseResult from './ParseResult'
import { parseTaskInput } from './mockParser'
import { useApp } from '../../context/AppContext'
import { t } from '../../utils/i18n'

export default function AITab({ onAddScheduled, onAddInbox }) {
  const [result, setResult] = useState(null)
  const [editingSuggestionIndex, setEditingSuggestionIndex] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const { accentColor, theme, language, setTab } = useApp()

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

  function handleRemoveResultItem(indexToRemove) {
    if (!result || result.intent !== 'batch' || !Array.isArray(result.items)) return

    const remainingItems = result.items.filter((_, index) => index !== indexToRemove)
    if (remainingItems.length === 0) {
      setResult(null)
    } else if (remainingItems.length === 1) {
      setResult(remainingItems[0])
    } else {
      setResult({ ...result, items: remainingItems })
    }
  }

  function getResultItems() {
    if (!result) return []
    return result.intent === 'batch' && Array.isArray(result.items)
      ? result.items
      : [result]
  }

  function getEditingSuggestion() {
    if (editingSuggestionIndex === null) return null
    return getResultItems()[editingSuggestionIndex] || null
  }

  function updateSuggestion(indexToUpdate, updates) {
    if (!result) return

    const applyUpdates = (item) => ({
      ...item,
      intent: 'schedule',
      title: updates.title,
      date: updates.date,
      time: updates.start_time,
      duration: updates.duration,
      repeat_frequency: updates.repeat_frequency || 'none',
      notification_moments: updates.notification_moments,
      notes: updates.notes !== undefined ? updates.notes : item.notes,
    })

    if (result.intent === 'batch' && Array.isArray(result.items)) {
      setResult({
        ...result,
        items: result.items.map((item, index) => (
          index === indexToUpdate ? applyUpdates(item) : item
        )),
      })
      return
    }

    setResult(applyUpdates(result))
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
        notes: item.notes || undefined,
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
            {t(language, 'ai.title')}
          </h1>
        </div>
        <p className={`text-sm mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          {t(language, 'ai.subtitle')}
        </p>
      </div>

      <div className="safe-scroll-bottom flex-1 overflow-y-auto px-6 pt-6 space-y-6">
        {/* Prompt input */}
        <PromptInput onSubmit={handleSubmit} isProcessing={isProcessing} />

        {/* Example prompts */}
        <div>
          <p className={`text-xs font-medium mb-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            {t(language, 'ai.trySaying')}
          </p>
          <div className="flex flex-wrap gap-2">
            {t(language, 'ai.examples').map((prompt, i) => (
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
          <ParseResult
            result={result}
            onConfirm={handleConfirm}
            onDismiss={() => setResult(null)}
            onRemoveItem={handleRemoveResultItem}
            onEditItem={setEditingSuggestionIndex}
          />
        )}
      </div>

      {getEditingSuggestion()?.intent === 'schedule' && (
        <AddTaskModal
          mode="edit"
          showDateField
          initialTask={{
            ...getEditingSuggestion(),
            start_time: getEditingSuggestion().time || '09:00',
            repeat_interval: 1,
          }}
          selectedDate={getEditingSuggestion().date}
          onClose={() => setEditingSuggestionIndex(null)}
          onAdd={(updates) => {
            updateSuggestion(editingSuggestionIndex, updates)
            setEditingSuggestionIndex(null)
          }}
        />
      )}
    </div>
  )
}

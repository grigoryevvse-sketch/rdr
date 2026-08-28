import { useState } from 'react'
import { Image, Loader2, Send, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { t } from '../../utils/i18n'

export default function PromptInput({ onSubmit, isProcessing }) {
  const [value, setValue] = useState('')
  const [image, setImage] = useState(null)
  const { theme, language } = useApp()

  function handleSubmit(e) {
    e.preventDefault()
    if ((!value.trim() && !image) || isProcessing) return
    onSubmit(value.trim(), image)
    setValue('')
    setImage(null)
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const base64 = dataUrl.split(',')[1]
      if (!base64) return

      setImage({
        name: file.name,
        mimeType: file.type,
        data: base64,
        previewUrl: dataUrl,
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {image && (
        <div className={`flex items-center gap-3 rounded-2xl p-3 glass-card`}>
          <img
            src={image.previewUrl}
            alt=""
            className="h-14 w-14 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {image.name}
            </p>
            <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
              {t(language, 'ai.attachedImage')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImage(null)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all cursor-pointer glass-pill
              ${theme === 'dark'
                ? 'text-gray-400 hover:text-gray-300'
                : 'text-gray-500 hover:text-gray-700'}`}
            title={t(language, 'ai.removeImage')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="relative">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
        placeholder={t(language, 'ai.placeholder')}
        rows={3}
        className={`w-full px-4 py-4 pr-28 rounded-2xl text-sm resize-none outline-none transition-all glass-input focus:shadow-[0_0_20px_var(--color-accent-light)]
          ${theme === 'dark'
            ? 'text-white placeholder-gray-500'
            : 'text-gray-900 placeholder-gray-400'}`}
      />
      <label
        className={`absolute bottom-3 right-14 w-10 h-10 rounded-xl
                   flex items-center justify-center active:scale-95
                   transition-all cursor-pointer glass-pill
                   ${theme === 'dark'
                     ? 'text-gray-300 hover:text-white'
                     : 'text-gray-500 hover:text-gray-700'}`}
        title={t(language, 'ai.attachImage')}
      >
        <Image size={16} />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="sr-only"
          disabled={isProcessing}
        />
      </label>
      <button
        type="submit"
        disabled={isProcessing || (!value.trim() && !image)}
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
      </div>
    </form>
  )
}

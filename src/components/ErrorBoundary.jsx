import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info)
  }

  handleResetLocalSettings = () => {
    try {
      localStorage.removeItem('planner-theme')
      localStorage.removeItem('planner-accent')
      localStorage.removeItem('planner-notification-settings')
    } catch {
      // Ignore storage failures and still reload.
    }

    window.location.reload()
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="app-viewport flex items-center justify-center bg-[#0d0d14] px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-accent">
            <AlertTriangle size={24} />
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            The app hit an unexpected error, but it can recover without leaving you on a blank screen.
          </p>
          {this.state.error?.message && (
            <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-left text-xs leading-relaxed text-gray-300">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <RefreshCw size={16} />
              Reload app
            </button>
            <button
              type="button"
              onClick={this.handleResetLocalSettings}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
            >
              Reset settings
            </button>
          </div>
        </div>
      </div>
    )
  }
}

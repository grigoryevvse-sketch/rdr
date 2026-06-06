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
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <RefreshCw size={16} />
            Reload app
          </button>
        </div>
      </div>
    )
  }
}

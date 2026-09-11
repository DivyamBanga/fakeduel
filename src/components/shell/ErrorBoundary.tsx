import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: { children: ReactNode }) {
    if (prev.children !== this.props.children && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="m-4 rounded-md p-6 text-center" style={{ background: 'var(--fd-surface)' }}>
        <div className="text-[18px] font-semibold" style={{ color: 'var(--fd-fg)' }}>
          Something went wrong
        </div>
        <div className="text-[13px] mt-2 break-words" style={{ color: 'var(--fd-fg-3)' }}>
          {this.state.error.message}
        </div>
        <button onClick={() => this.setState({ error: null })} className="mt-4 h-[40px] px-6 rounded text-[14px] font-semibold text-white" style={{ background: '#128000' }}>
          Try again
        </button>
      </div>
    )
  }
}

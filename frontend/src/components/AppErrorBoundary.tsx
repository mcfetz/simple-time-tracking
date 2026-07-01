import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('App startup/render error', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <div className="card" style={{ maxWidth: 480 }}>
            <strong>App could not be opened</strong>
            <div className="muted">A startup problem was detected. Reload the app to fetch a fresh version.</div>
            <button type="button" onClick={this.handleReload}>
              Reload app
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

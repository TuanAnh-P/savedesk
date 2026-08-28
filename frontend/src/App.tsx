import { Component, type ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { CustomerListPage } from './pages/CustomerListPage'

/**
 * Catches render errors anywhere below it.
 *
 * Query failures are handled by each screen; this is the backstop that stops a
 * bug in one component from leaving the agent looking at a white page.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-state" role="alert">
          <h2 className="error-state__title">This page could not be displayed</h2>
          <p className="error-state__detail">{this.state.error.message}</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <>
      <nav className="topbar">
        <Link className="topbar__brand" to="/">
          savedesk
        </Link>
        <span className="topbar__tag">Churn risk &amp; retention console</span>
      </nav>

      <main>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<CustomerListPage />} />
            <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
            <Route
              path="*"
              element={
                <div className="page">
                  <h1>Page not found</h1>
                  <Link className="button" to="/">
                    Back to queue
                  </Link>
                </div>
              }
            />
          </Routes>
        </ErrorBoundary>
      </main>
    </>
  )
}

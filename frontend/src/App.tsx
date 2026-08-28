import { Component, type ReactNode } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

import { AppShell } from './components/AppShell'
import { Button } from './components/ui/button'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { CustomerListPage } from './pages/CustomerListPage'
import { ModelPage } from './pages/ModelPage'

/**
 * Catches render errors anywhere below it.
 *
 * Query failures are handled by each screen; this is the backstop that stops a
 * bug in one component leaving the agent looking at a white page.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-500/20 dark:bg-red-500/10"
        >
          <h2 className="text-base font-semibold text-red-800 dark:text-red-200">
            This page could not be displayed
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {this.state.error.message}
          </p>
          <Button outline onClick={() => window.location.reload()} className="mt-4">
            Reload
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <AppShell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<CustomerListPage />} />
          <Route path="/model" element={<ModelPage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
          <Route
            path="*"
            element={
              <div className="mx-auto max-w-xl text-center">
                <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
                  Page not found
                </h1>
                <Link
                  to="/"
                  className="mt-4 inline-block text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                >
                  Back to queue
                </Link>
              </div>
            }
          />
        </Routes>
      </ErrorBoundary>
    </AppShell>
  )
}

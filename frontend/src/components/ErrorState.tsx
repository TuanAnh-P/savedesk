import { ApiError } from '../api/client'

interface Props {
  error: unknown
  onRetry?: () => void
}

/** Shows what actually went wrong. An agent should never face a blank screen. */
export function ErrorState({ error, onRetry }: Props) {
  const isApiError = error instanceof ApiError
  const title = isApiError ? error.title : 'Something went wrong'
  const detail = isApiError
    ? error.message
    : 'An unexpected error occurred while loading this page.'

  return (
    <div className="error-state" role="alert">
      <h2 className="error-state__title">{title}</h2>
      <p className="error-state__detail">{detail}</p>

      {isApiError && error.isNetworkError && (
        <p className="error-state__hint">
          Start the API with <code>uvicorn app.main:app</code> from the{' '}
          <code>backend/</code> directory.
        </p>
      )}

      {/* The request ID is what support needs to find this in the logs. */}
      {isApiError && error.requestId && (
        <p className="error-state__meta">
          Reference: <code>{error.requestId}</code>
        </p>
      )}

      {onRetry && (
        <button className="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner__dot" />
      {label}
    </div>
  )
}

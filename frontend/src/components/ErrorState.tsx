import { ExclamationTriangleIcon, InboxIcon } from '@heroicons/react/24/outline'

import { ApiError } from '../api/client'
import { Button } from './ui/button'

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
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10"
    >
      <div className="flex gap-3">
        <ExclamationTriangleIcon
          aria-hidden="true"
          className="size-5 shrink-0 text-red-500 dark:text-red-400"
        />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-red-800 dark:text-red-200">
            {title}
          </h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{detail}</p>

          {isApiError && error.isNetworkError && (
            <p className="mt-2 text-sm text-red-700/80 dark:text-red-300/80">
              Start the API with{' '}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs dark:bg-red-500/20">
                uvicorn app.main:app
              </code>{' '}
              from the{' '}
              <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs dark:bg-red-500/20">
                backend/
              </code>{' '}
              directory.
            </p>
          )}

          {/* The request ID is what support needs to find this in the logs. */}
          {isApiError && error.requestId && (
            <p className="mt-2 font-mono text-xs text-red-700/70 dark:text-red-300/70">
              Reference: {error.requestId}
            </p>
          )}

          {onRetry && (
            <Button outline onClick={onRetry} className="mt-3">
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-white/15">
      <InboxIcon aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
    </div>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-16 text-sm text-zinc-500 dark:text-zinc-400"
    >
      <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 motion-reduce:animate-none dark:border-zinc-700 dark:border-t-zinc-300" />
      {label}
    </div>
  )
}

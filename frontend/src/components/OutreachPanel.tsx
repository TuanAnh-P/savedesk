import { useState } from 'react'

import { ApiError } from '../api/client'
import { useUpdateOutreach } from '../api/queries'
import { StatusBadge } from './Badges'
import { STATUS_LABELS } from './presentation'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import type { ModelInfo, Outreach, OutreachStatus } from '../types/api'

interface Props {
  customerId: string
  outreach: Outreach
  workflow?: ModelInfo['workflow']
}

/**
 * The "act" half of the console.
 *
 * Only the transitions the API allows are offered, and the button labels come
 * from the workflow the API publishes, so the UI cannot request a move that
 * would be rejected and cannot disagree with the server about its name.
 */
export function OutreachPanel({ customerId, outreach, workflow }: Props) {
  const [note, setNote] = useState('')
  const mutation = useUpdateOutreach(customerId)

  const labelFor = (target: OutreachStatus) =>
    workflow?.transitions.find(
      (transition) => transition.from === outreach.status && transition.to === target,
    )?.label ?? `Move to ${STATUS_LABELS[target]}`

  const submit = (status: OutreachStatus) => {
    mutation.mutate(
      { status, note: note.trim() || undefined },
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <section
      aria-label="Outreach"
      className="rounded-lg border border-zinc-950/5 bg-white p-5 dark:border-white/10 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Outreach
        </h2>
        <StatusBadge status={outreach.status} />
      </div>

      {outreach.updated_at && (
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Last updated {new Date(outreach.updated_at).toLocaleString()}
        </p>
      )}

      {mutation.isError && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10"
        >
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {mutation.error instanceof ApiError
              ? mutation.error.title
              : 'Update failed'}
          </p>
          <p className="mt-0.5 text-sm text-red-700 dark:text-red-300">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'The status could not be updated.'}
          </p>
        </div>
      )}

      {outreach.allowed_next.length > 0 ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Note (optional)
            </span>
            <Textarea
              rows={2}
              maxLength={500}
              value={note}
              placeholder="What happened on this contact?"
              onChange={(event) => setNote(event.target.value)}
              disabled={mutation.isPending}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {outreach.allowed_next.map((target) => (
              <Button
                key={target}
                onClick={() => submit(target)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Saving…' : labelFor(target)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No further actions available.
        </p>
      )}

      <h3 className="mt-6 border-t border-zinc-950/5 pt-4 text-sm font-semibold text-zinc-950 dark:border-white/10 dark:text-white">
        History
      </h3>
      {outreach.history.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing recorded yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-3">
          {[...outreach.history].reverse().map((entry, index) => (
            <li
              key={index}
              className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-700"
            >
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {STATUS_LABELS[entry.from_status]} &rarr;{' '}
                  <strong className="font-medium text-zinc-950 dark:text-white">
                    {STATUS_LABELS[entry.to_status]}
                  </strong>
                </span>
                <time
                  dateTime={entry.at}
                  className="text-xs text-zinc-500 dark:text-zinc-500"
                >
                  {new Date(entry.at).toLocaleString()}
                </time>
              </div>
              {entry.note && (
                <p className="mt-0.5 text-xs italic text-zinc-500 dark:text-zinc-400">
                  {entry.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

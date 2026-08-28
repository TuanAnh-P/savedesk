import { useState } from 'react'

import { useUpdateOutreach } from '../api/queries'
import { ApiError } from '../api/client'
import { StatusBadge, STATUS_LABELS } from './Badges'
import type { ModelInfo, Outreach, OutreachStatus } from '../types/api'

interface Props {
  customerId: string
  outreach: Outreach
  workflow?: ModelInfo['workflow']
}

/**
 * The "act" half of the console.
 *
 * Only the transitions the API allows are offered, and the labels come from the
 * workflow the API publishes, so the UI cannot request a move that would be
 * rejected and cannot disagree with the server about what a move is called.
 */
export function OutreachPanel({ customerId, outreach, workflow }: Props) {
  const [note, setNote] = useState('')
  const mutation = useUpdateOutreach(customerId)

  const labelFor = (target: OutreachStatus) =>
    workflow?.transitions.find(
      (transition) =>
        transition.from === outreach.status && transition.to === target,
    )?.label ?? `Move to ${STATUS_LABELS[target]}`

  const submit = (status: OutreachStatus) => {
    mutation.mutate(
      { status, note: note.trim() || undefined },
      { onSuccess: () => setNote('') },
    )
  }

  return (
    <section className="outreach" aria-label="Outreach">
      <div className="outreach__header">
        <h2>Outreach</h2>
        <StatusBadge status={outreach.status} />
      </div>

      {outreach.updated_at && (
        <p className="outreach__updated">
          Last updated {new Date(outreach.updated_at).toLocaleString()}
        </p>
      )}

      {mutation.isError && (
        <div className="outreach__error" role="alert">
          <strong>
            {mutation.error instanceof ApiError
              ? mutation.error.title
              : 'Update failed'}
          </strong>
          <p>
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'The status could not be updated.'}
          </p>
        </div>
      )}

      {outreach.allowed_next.length > 0 ? (
        <>
          <label className="field">
            <span className="field__label">Note (optional)</span>
            <textarea
              className="field__input"
              rows={2}
              maxLength={500}
              value={note}
              placeholder="What happened on this contact?"
              onChange={(event) => setNote(event.target.value)}
              disabled={mutation.isPending}
            />
          </label>

          <div className="outreach__actions">
            {outreach.allowed_next.map((target) => (
              <button
                key={target}
                className="button button--primary"
                onClick={() => submit(target)}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Saving…' : labelFor(target)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="outreach__none">No further actions available.</p>
      )}

      <h3 className="outreach__history-title">History</h3>
      {outreach.history.length === 0 ? (
        <p className="outreach__none">Nothing recorded yet.</p>
      ) : (
        <ol className="history">
          {[...outreach.history].reverse().map((entry, index) => (
            <li key={index} className="history__item">
              <div className="history__line">
                <span>
                  {STATUS_LABELS[entry.from_status]} &rarr;{' '}
                  <strong>{STATUS_LABELS[entry.to_status]}</strong>
                </span>
                <time dateTime={entry.at}>
                  {new Date(entry.at).toLocaleString()}
                </time>
              </div>
              {entry.note && <p className="history__note">{entry.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

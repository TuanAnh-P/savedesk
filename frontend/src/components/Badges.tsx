import type { OutreachStatus, RiskTier } from '../types/api'

const STATUS_LABELS: Record<OutreachStatus, string> = {
  NOT_CONTACTED: 'Not contacted',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  UNREACHABLE: 'Unreachable',
}

// Tier is shown as colour *and* text: colour alone would exclude colour-blind
// agents, and this is the field the whole workflow keys off.
export function RiskBadge({ tier, score }: { tier: RiskTier; score?: number }) {
  return (
    <span className={`badge badge--${tier.toLowerCase()}`}>
      {tier}
      {score !== undefined && <span className="badge__score">{score}</span>}
    </span>
  )
}

export function StatusBadge({ status }: { status: OutreachStatus }) {
  return (
    <span className={`status status--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export { STATUS_LABELS }

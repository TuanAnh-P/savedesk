import { STATUS_BADGE_COLOR, STATUS_LABELS, TIER_BADGE_COLOR } from './presentation'
import { Badge } from './ui/badge'
import type { OutreachStatus, RiskTier } from '../types/api'

export function RiskBadge({ tier, score }: { tier: RiskTier; score?: number }) {
  return (
    <Badge color={TIER_BADGE_COLOR[tier]}>
      {tier}
      {score !== undefined && (
        <span className="ml-1 tabular-nums opacity-75">{score}</span>
      )}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: OutreachStatus }) {
  return <Badge color={STATUS_BADGE_COLOR[status]}>{STATUS_LABELS[status]}</Badge>
}

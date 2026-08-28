import type { OutreachStatus, RiskTier } from '../types/api'

/**
 * How domain values are presented. Shared by the badges, the queue tiles and
 * the model page so the same tier never appears in two different colours.
 *
 * Heat only where there is heat: LOW is neutral zinc so the eye lands on the
 * customers who need calling. Tier text is always rendered alongside the
 * colour, never colour alone.
 */
export const TIER_BADGE_COLOR: Record<RiskTier, 'red' | 'orange' | 'amber' | 'zinc'> = {
  CRITICAL: 'red',
  HIGH: 'orange',
  MEDIUM: 'amber',
  LOW: 'zinc',
}

/** Dot and bar fills, matched to the badge colours above. */
export const TIER_FILL: Record<RiskTier, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-500',
  LOW: 'bg-zinc-400',
}

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  NOT_CONTACTED: 'Not contacted',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  UNREACHABLE: 'Unreachable',
}

export const STATUS_BADGE_COLOR: Record<
  OutreachStatus,
  'zinc' | 'blue' | 'green' | 'yellow'
> = {
  NOT_CONTACTED: 'zinc',
  IN_PROGRESS: 'blue',
  RESOLVED: 'green',
  UNREACHABLE: 'yellow',
}

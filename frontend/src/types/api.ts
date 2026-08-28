// Mirrors the backend response schemas. Defined once and shared, so the client
// and the components cannot drift apart.

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export type OutreachStatus =
  | 'NOT_CONTACTED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'UNREACHABLE'

export interface Page<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface CustomerListItem {
  customer_id: string
  tenure: number
  contract: string
  monthly_charges: number
  risk_score: number
  risk_tier: RiskTier
  outreach_status: OutreachStatus
}

export interface RiskFactor {
  key: string
  label: string
  observed: string
  points: number
  max_points: number
  rationale: string
}

export interface OutreachTransition {
  from_status: OutreachStatus
  to_status: OutreachStatus
  at: string
  note: string | null
}

export interface Outreach {
  status: OutreachStatus
  updated_at: string | null
  history: OutreachTransition[]
  allowed_next: OutreachStatus[]
}

export interface CustomerProfile {
  customer_id: string
  gender: string
  senior_citizen: boolean
  partner: boolean
  dependents: boolean
  tenure: number
  phone_service: boolean
  multiple_lines: string
  internet_service: string
  online_security: string
  online_backup: string
  device_protection: string
  tech_support: string
  streaming_tv: string
  streaming_movies: string
  contract: string
  paperless_billing: boolean
  payment_method: string
  monthly_charges: number
  total_charges: number
}

export interface CustomerDetail {
  profile: CustomerProfile
  risk_score: number
  risk_tier: RiskTier
  factors: RiskFactor[]
  outreach: Outreach
}

export interface ModelInfo {
  scoring: {
    version: string
    method: string
    max_score: number
    tiers: { tier: RiskTier; min_score: number }[]
    factors: {
      key: string
      label: string
      rationale: string
      max_points: number
      bands: { condition: string; points: number }[]
    }[]
    excluded_fields: { field: string; reason: string }[]
  }
  workflow: {
    initial_state: OutreachStatus
    states: OutreachStatus[]
    transitions: { from: OutreachStatus; to: OutreachStatus; label: string }[]
  }
  validation: {
    dataset_size: number
    note: string
    tiers: {
      tier: RiskTier
      customers: number
      share_of_book: number
      historical_churn_rate: number
    }[]
  }
}

export interface CustomerFilters {
  risk_tier?: RiskTier | ''
  contract?: string
  outreach_status?: OutreachStatus | ''
  search?: string
  sort_by?: 'risk_score' | 'tenure' | 'monthly_charges' | 'customer_id'
  order?: 'asc' | 'desc'
  page?: number
  page_size?: number
}

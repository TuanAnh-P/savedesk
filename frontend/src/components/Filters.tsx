import type { CustomerFilters, OutreachStatus, RiskTier } from '../types/api'

interface Props {
  filters: CustomerFilters
  onChange: (patch: Partial<CustomerFilters>) => void
  onReset: () => void
  resultCount?: number
}

const TIERS: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const CONTRACTS = ['Month-to-month', 'One year', 'Two year']
const STATUSES: OutreachStatus[] = [
  'NOT_CONTACTED',
  'IN_PROGRESS',
  'RESOLVED',
  'UNREACHABLE',
]

export function Filters({ filters, onChange, onReset, resultCount }: Props) {
  const hasFilters = Boolean(
    filters.risk_tier || filters.contract || filters.outreach_status || filters.search,
  )

  return (
    <section className="filters" aria-label="Filter customers">
      <div className="filters__row">
        <label className="field">
          <span className="field__label">Search customer ID</span>
          <input
            className="field__input"
            type="search"
            placeholder="e.g. 7590-VHVEG"
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">Risk tier</span>
          <select
            className="field__input"
            value={filters.risk_tier ?? ''}
            onChange={(event) =>
              onChange({ risk_tier: event.target.value as RiskTier | '' })
            }
          >
            <option value="">All tiers</option>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Contract</span>
          <select
            className="field__input"
            value={filters.contract ?? ''}
            onChange={(event) => onChange({ contract: event.target.value })}
          >
            <option value="">All contracts</option>
            {CONTRACTS.map((contract) => (
              <option key={contract} value={contract}>
                {contract}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Outreach</span>
          <select
            className="field__input"
            value={filters.outreach_status ?? ''}
            onChange={(event) =>
              onChange({ outreach_status: event.target.value as OutreachStatus | '' })
            }
          >
            <option value="">Any status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Sort by</span>
          <select
            className="field__input"
            value={`${filters.sort_by ?? 'risk_score'}:${filters.order ?? 'desc'}`}
            onChange={(event) => {
              const [sort_by, order] = event.target.value.split(':')
              onChange({
                sort_by: sort_by as CustomerFilters['sort_by'],
                order: order as 'asc' | 'desc',
              })
            }}
          >
            <option value="risk_score:desc">Highest risk</option>
            <option value="risk_score:asc">Lowest risk</option>
            <option value="tenure:asc">Newest customers</option>
            <option value="monthly_charges:desc">Highest spend</option>
          </select>
        </label>
      </div>

      <div className="filters__meta">
        {resultCount !== undefined && (
          <span>
            <strong>{resultCount.toLocaleString()}</strong> customer
            {resultCount === 1 ? '' : 's'} match
          </span>
        )}
        {hasFilters && (
          <button className="button button--link" onClick={onReset}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}

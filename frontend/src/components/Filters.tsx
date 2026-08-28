import { Input } from './ui/input'
import { Select } from './ui/select'
import type { CustomerFilters, OutreachStatus, RiskTier } from '../types/api'

interface Props {
  filters: CustomerFilters
  onChange: (patch: Partial<CustomerFilters>) => void
  onReset: () => void
  resultCount?: number
}

const TIERS: RiskTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const CONTRACTS = ['Month-to-month', 'One year', 'Two year']
const STATUSES: { value: OutreachStatus; label: string }[] = [
  { value: 'NOT_CONTACTED', label: 'Not contacted' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'UNREACHABLE', label: 'Unreachable' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  )
}

export function Filters({ filters, onChange, onReset, resultCount }: Props) {
  const hasFilters = Boolean(
    filters.risk_tier || filters.contract || filters.outreach_status || filters.search,
  )

  return (
    <section
      aria-label="Filter customers"
      className="rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-zinc-900"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search customer ID">
          <Input
            type="search"
            autoComplete="off"
            placeholder="e.g. 7590-VHVEG"
            value={filters.search ?? ''}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </Field>

        <Field label="Risk tier">
          <Select
            autoComplete="off"
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
          </Select>
        </Field>

        <Field label="Contract">
          <Select
            autoComplete="off"
            value={filters.contract ?? ''}
            onChange={(event) => onChange({ contract: event.target.value })}
          >
            <option value="">All contracts</option>
            {CONTRACTS.map((contract) => (
              <option key={contract} value={contract}>
                {contract}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Outreach">
          <Select
            autoComplete="off"
            value={filters.outreach_status ?? ''}
            onChange={(event) =>
              onChange({ outreach_status: event.target.value as OutreachStatus | '' })
            }
          >
            <option value="">Any status</option>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sort by">
          <Select
            autoComplete="off"
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
          </Select>
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
        {resultCount !== undefined && (
          <span>
            <strong className="font-semibold text-zinc-950 dark:text-white">
              {resultCount.toLocaleString()}
            </strong>{' '}
            customer{resultCount === 1 ? '' : 's'} match
          </span>
        )}
        {hasFilters && (
          <button
            onClick={onReset}
            className="text-zinc-950 underline underline-offset-2 hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300"
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}

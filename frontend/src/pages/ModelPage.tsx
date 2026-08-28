import { useModelInfo } from '../api/queries'
import { TIER_FILL } from '../components/presentation'
import { ErrorState, Spinner } from '../components/ErrorState'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import type { RiskTier } from '../types/api'

function Card({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-950/5 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/**
 * Surfaces GET /model/info: the rules the score is built from, and how well
 * those rules separate risk when measured against the dataset's own outcomes.
 * Read-only — tuning weights would need versioning and an audit trail.
 */
export function ModelPage() {
  const modelInfo = useModelInfo()

  if (modelInfo.isPending) return <Spinner label="Loading model" />
  if (modelInfo.isError) {
    return (
      <div className="mx-auto max-w-7xl">
        <ErrorState error={modelInfo.error} onRetry={() => modelInfo.refetch()} />
      </div>
    )
  }

  const { scoring, validation } = modelInfo.data

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
          Scoring model
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Version {scoring.version} &middot; {scoring.method.replace(/_/g, ' ')}{' '}
          &middot; scored out of {scoring.max_score}
        </p>
      </header>

      <Card
        title="How well it separates"
        description={validation.note}
      >
        <Table dense>
          <TableHead>
            <TableRow>
              <TableHeader>Tier</TableHeader>
              <TableHeader>Customers</TableHeader>
              <TableHeader>Share of book</TableHeader>
              <TableHeader>Historically churned</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {validation.tiers.map((tier) => (
              <TableRow key={tier.tier}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium text-zinc-950 dark:text-white">
                    <span
                      aria-hidden="true"
                      className={`size-2 rounded-full ${TIER_FILL[tier.tier as RiskTier]}`}
                    />
                    {tier.tier}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">
                  {tier.customers.toLocaleString()}
                </TableCell>
                <TableCell className="tabular-nums">
                  {(tier.share_of_book * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="font-medium tabular-nums text-zinc-950 dark:text-white">
                  {(tier.historical_churn_rate * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card
        title="Tier thresholds"
        description="The score band a customer falls into decides where they sit in the queue."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {scoring.tiers.map((tier) => (
            <div
              key={tier.tier}
              className="rounded-md border border-zinc-950/5 p-3 dark:border-white/10"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${TIER_FILL[tier.tier]}`}
                />
                {tier.tier}
              </span>
              <span className="mt-1 block text-sm text-zinc-950 dark:text-white">
                Score {tier.min_score} and above
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Scoring factors"
        description="Weights were set from each factor's churn rate in the dataset, measured against the base rate. Points are added, then capped."
      >
        <div className="space-y-5">
          {scoring.factors.map((factor) => (
            <div
              key={factor.key}
              className="border-b border-zinc-950/5 pb-5 last:border-0 last:pb-0 dark:border-white/10"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
                  {factor.label}
                </h3>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  up to {factor.max_points} points
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {factor.rationale}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {factor.bands.map((band) => (
                  <li
                    key={band.condition}
                    className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-white/5 dark:text-zinc-300"
                  >
                    {band.condition}
                    <span className="ml-1.5 font-semibold tabular-nums text-zinc-950 dark:text-white">
                      +{band.points}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Excluded from scoring"
        description="Fields present in the dataset that the model deliberately does not use."
      >
        <ul className="space-y-3">
          {scoring.excluded_fields.map((excluded) => (
            <li key={excluded.field}>
              <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                {excluded.field}
              </span>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {excluded.reason}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

import type { RiskFactor } from '../types/api'

interface Props {
  factors: RiskFactor[]
  totalScore: number
}

/**
 * Why this customer scored what they did.
 *
 * Bars are drawn relative to the largest contribution so the ranking is visible
 * at a glance: the agent reads what to lead the call with, not a table.
 */
export function FactorBreakdown({ factors, totalScore }: Props) {
  const contributing = factors
    .filter((factor) => factor.points > 0)
    .sort((a, b) => b.points - a.points)
  const neutral = factors.filter((factor) => factor.points === 0)
  const largest = contributing[0]?.points ?? 1

  return (
    <section className="rounded-lg border border-zinc-950/5 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Why this score
        </h2>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {contributing.length} factor{contributing.length === 1 ? '' : 's'} adding
          up to {totalScore}
        </span>
      </div>

      {contributing.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No risk factors apply to this customer. They score 0.
        </p>
      ) : (
        <ul className="mt-5 space-y-5">
          {contributing.map((factor) => (
            <li key={factor.key}>
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-medium text-zinc-950 dark:text-white">
                  {factor.label}
                </span>
                <span className="flex-1 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {factor.observed}
                </span>
                <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">
                  +{factor.points}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-800 dark:bg-zinc-300"
                  style={{ width: `${(factor.points / largest) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                {factor.rationale}
              </p>
            </li>
          ))}
        </ul>
      )}

      {neutral.length > 0 && (
        <details className="mt-5 border-t border-zinc-950/5 pt-4 dark:border-white/10">
          <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white">
            {neutral.length} factor{neutral.length === 1 ? '' : 's'} added nothing
          </summary>
          <ul className="mt-3 space-y-1.5">
            {neutral.map((factor) => (
              <li
                key={factor.key}
                className="flex justify-between gap-4 text-sm text-zinc-500 dark:text-zinc-400"
              >
                <span>{factor.label}</span>
                <span>{factor.observed}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

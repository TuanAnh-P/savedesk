import type { RiskFactor } from '../types/api'

interface Props {
  factors: RiskFactor[]
  totalScore: number
}

/**
 * Why this customer scored what they did.
 *
 * Bars are drawn relative to the largest contribution so the ranking is visible
 * at a glance; the agent reads "what should I lead the call with", not a table.
 */
export function FactorBreakdown({ factors, totalScore }: Props) {
  const contributing = factors
    .filter((factor) => factor.points > 0)
    .sort((a, b) => b.points - a.points)
  const neutral = factors.filter((factor) => factor.points === 0)
  const largest = contributing[0]?.points ?? 1

  return (
    <div className="breakdown">
      <div className="breakdown__header">
        <h2>Why this score</h2>
        <span className="breakdown__total">
          {contributing.length} factor{contributing.length === 1 ? '' : 's'} adding up
          to {totalScore}
        </span>
      </div>

      {contributing.length === 0 ? (
        <p className="breakdown__none">
          No risk factors apply to this customer. They score 0.
        </p>
      ) : (
        <ul className="breakdown__list">
          {contributing.map((factor) => (
            <li key={factor.key} className="factor">
              <div className="factor__head">
                <span className="factor__label">{factor.label}</span>
                <span className="factor__observed">{factor.observed}</span>
                <span className="factor__points">+{factor.points}</span>
              </div>
              <div className="factor__bar">
                <div
                  className="factor__fill"
                  style={{ width: `${(factor.points / largest) * 100}%` }}
                />
              </div>
              <p className="factor__rationale">{factor.rationale}</p>
            </li>
          ))}
        </ul>
      )}

      {neutral.length > 0 && (
        <details className="breakdown__neutral">
          <summary>
            {neutral.length} factor{neutral.length === 1 ? '' : 's'} added nothing
          </summary>
          <ul>
            {neutral.map((factor) => (
              <li key={factor.key}>
                <span>{factor.label}</span>
                <span className="factor__observed">{factor.observed}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

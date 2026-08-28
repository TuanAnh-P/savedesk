import { Link, useParams } from 'react-router-dom'

import { useCustomer, useModelInfo } from '../api/queries'
import { RiskBadge } from '../components/Badges'
import { ErrorState, Spinner } from '../components/ErrorState'
import { FactorBreakdown } from '../components/FactorBreakdown'
import { OutreachPanel } from '../components/OutreachPanel'
import type { CustomerProfile } from '../types/api'

const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

function profileRows(profile: CustomerProfile) {
  return [
    ['Tenure', `${profile.tenure} months`],
    ['Contract', profile.contract],
    ['Monthly charges', `$${profile.monthly_charges.toFixed(2)}`],
    ['Total charges', `$${profile.total_charges.toFixed(2)}`],
    ['Payment method', profile.payment_method],
    ['Paperless billing', yesNo(profile.paperless_billing)],
    ['Internet service', profile.internet_service],
    ['Online security', profile.online_security],
    ['Online backup', profile.online_backup],
    ['Device protection', profile.device_protection],
    ['Tech support', profile.tech_support],
    ['Streaming TV', profile.streaming_tv],
    ['Streaming movies', profile.streaming_movies],
    ['Phone service', yesNo(profile.phone_service)],
    ['Multiple lines', profile.multiple_lines],
    ['Senior citizen', yesNo(profile.senior_citizen)],
    ['Partner', yesNo(profile.partner)],
    ['Dependents', yesNo(profile.dependents)],
  ] as const
}

export function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const customer = useCustomer(customerId)
  const modelInfo = useModelInfo()

  if (customer.isPending) return <Spinner label="Loading customer" />

  if (customer.isError) {
    return (
      <div className="page">
        <Link className="back-link" to="/">
          &larr; Back to queue
        </Link>
        <ErrorState error={customer.error} onRetry={() => customer.refetch()} />
      </div>
    )
  }

  const { profile, risk_score, risk_tier, factors, outreach } = customer.data

  return (
    <div className="page">
      <Link className="back-link" to="/">
        &larr; Back to queue
      </Link>

      <header className="detail__header">
        <div>
          <h1>{profile.customer_id}</h1>
          <p className="page__subtitle">
            {profile.contract} &middot; {profile.tenure} months &middot; $
            {profile.monthly_charges.toFixed(2)}/mo
          </p>
        </div>
        <div className="detail__score">
          <span className="detail__score-value">{risk_score}</span>
          <RiskBadge tier={risk_tier} />
        </div>
      </header>

      <div className="detail__grid">
        <div className="detail__main">
          <FactorBreakdown factors={factors} totalScore={risk_score} />

          <section className="profile">
            <h2>Customer record</h2>
            <dl className="profile__grid">
              {profileRows(profile).map(([label, value]) => (
                <div key={label} className="profile__row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside className="detail__side">
          <OutreachPanel
            customerId={profile.customer_id}
            outreach={outreach}
            workflow={modelInfo.data?.workflow}
          />
        </aside>
      </div>
    </div>
  )
}

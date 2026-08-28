import { ArrowLeftIcon } from '@heroicons/react/16/solid'
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

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
    >
      <ArrowLeftIcon className="size-4" />
      Back to queue
    </Link>
  )
}

export function CustomerDetailPage() {
  const { customerId = '' } = useParams()
  const customer = useCustomer(customerId)
  const modelInfo = useModelInfo()

  if (customer.isPending) return <Spinner label="Loading customer" />

  if (customer.isError) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <BackLink />
        <ErrorState error={customer.error} onRetry={() => customer.refetch()} />
      </div>
    )
  }

  const { profile, risk_score, risk_tier, factors, outreach } = customer.data

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <BackLink />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
            {profile.customer_id}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {profile.contract} &middot; {profile.tenure} months &middot; $
            {profile.monthly_charges.toFixed(2)}/mo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-4xl font-semibold tabular-nums leading-none text-zinc-950 dark:text-white">
            {risk_score}
          </span>
          <RiskBadge tier={risk_tier} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <FactorBreakdown factors={factors} totalScore={risk_score} />

          <section className="rounded-lg border border-zinc-950/5 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
              Customer record
            </h2>
            <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
              {profileRows(profile).map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between gap-4 border-b border-zinc-950/5 py-2 text-sm dark:border-white/10"
                >
                  <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="text-right font-medium text-zinc-950 dark:text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        {/* Sticky so the action stays visible while the record is scrolled. */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
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

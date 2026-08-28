import { useMemo, useState } from 'react'

import { useCustomers, useModelInfo } from '../api/queries'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { TIER_FILL } from '../components/presentation'
import { EmptyState, ErrorState, Spinner } from '../components/ErrorState'
import { Filters } from '../components/Filters'
import { Pagination } from '../components/Pagination'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { useDebounced } from '../hooks/useDebounced'
import type { CustomerFilters, RiskTier } from '../types/api'

const DEFAULT_FILTERS: CustomerFilters = {
  page: 1,
  page_size: 25,
  sort_by: 'risk_score',
  order: 'desc',
}

export function CustomerListPage() {
  const [filters, setFilters] = useState<CustomerFilters>(DEFAULT_FILTERS)
  const debouncedSearch = useDebounced(filters.search ?? '')

  // The request uses the debounced search term; the input stays responsive.
  const query = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  )

  const customers = useCustomers(query)
  const modelInfo = useModelInfo()

  // Any filter change returns to page 1: staying on page 12 of a narrower
  // result set would show an empty table.
  const updateFilters = (patch: Partial<CustomerFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }))

  // Retry both queries. The model info is cached indefinitely, so if it failed
  // during an outage it would otherwise stay failed and the tier tiles would
  // not come back until a full page reload.
  const retry = () => {
    customers.refetch()
    if (modelInfo.isError) modelInfo.refetch()
  }

  const tierCounts = modelInfo.data?.validation.tiers ?? []

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
          Retention queue
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Customers ranked by churn risk. Work from the top.
        </p>
      </header>

      {tierCounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tierCounts.map((tier) => {
            const active = filters.risk_tier === tier.tier
            return (
              <button
                key={tier.tier}
                aria-pressed={active}
                onClick={() =>
                  updateFilters({
                    risk_tier: active ? '' : (tier.tier as RiskTier),
                  })
                }
                className={`rounded-lg border bg-white p-4 text-left transition dark:bg-zinc-900 ${
                  active
                    ? 'border-zinc-950 ring-1 ring-zinc-950 dark:border-white dark:ring-white'
                    : 'border-zinc-950/5 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/25'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${TIER_FILL[tier.tier]}`}
                  />
                  <span className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                    {tier.tier}
                  </span>
                </span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">
                  {tier.customers.toLocaleString()}
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                  {(tier.historical_churn_rate * 100).toFixed(0)}% churned
                  historically
                </span>
              </button>
            )
          })}
        </div>
      )}

      <Filters
        filters={filters}
        onChange={updateFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        resultCount={customers.data?.total}
      />

      {customers.isPending ? (
        <Spinner label="Loading customers" />
      ) : customers.isError ? (
        <ErrorState error={customers.error} onRetry={retry} />
      ) : customers.data.items.length === 0 ? (
        <EmptyState message="No customers match these filters. Try widening your search." />
      ) : (
        <div className="rounded-lg border border-zinc-950/5 bg-white px-4 dark:border-white/10 dark:bg-zinc-900">
          <Table striped>
            <TableHead>
              <TableRow>
                <TableHeader>Risk</TableHeader>
                <TableHeader>Customer</TableHeader>
                <TableHeader>Tenure</TableHeader>
                <TableHeader>Contract</TableHeader>
                <TableHeader>Monthly</TableHeader>
                <TableHeader>Outreach</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {customers.data.items.map((customer) => (
                <TableRow
                  key={customer.customer_id}
                  href={`/customers/${customer.customer_id}`}
                  title={`Review ${customer.customer_id}`}
                >
                  <TableCell>
                    <RiskBadge
                      tier={customer.risk_tier}
                      score={customer.risk_score}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-zinc-950 dark:text-white">
                    {customer.customer_id}
                  </TableCell>
                  <TableCell>
                    {customer.tenure} mo
                    {customer.tenure === 0 && (
                      <span className="text-zinc-400"> (new)</span>
                    )}
                  </TableCell>
                  <TableCell>{customer.contract}</TableCell>
                  <TableCell className="tabular-nums">
                    ${customer.monthly_charges.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={customer.outreach_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {customers.data && (
        <Pagination
          page={customers.data.page}
          totalPages={customers.data.total_pages}
          total={customers.data.total}
          pageSize={customers.data.page_size}
          isFetching={customers.isFetching}
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      )}
    </div>
  )
}

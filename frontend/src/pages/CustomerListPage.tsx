import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCustomers, useModelInfo } from '../api/queries'
import { RiskBadge, StatusBadge } from '../components/Badges'
import { EmptyState, ErrorState, Spinner } from '../components/ErrorState'
import { Filters } from '../components/Filters'
import { Pagination } from '../components/Pagination'
import { useDebounced } from '../hooks/useDebounced'
import type { CustomerFilters } from '../types/api'

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
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Retention queue</h1>
          <p className="page__subtitle">
            Customers ranked by churn risk. Work from the top.
          </p>
        </div>
      </header>

      {tierCounts.length > 0 && (
        <div className="tiles">
          {tierCounts.map((tier) => (
            <button
              key={tier.tier}
              className={`tile tile--${tier.tier.toLowerCase()} ${
                filters.risk_tier === tier.tier ? 'tile--active' : ''
              }`}
              onClick={() =>
                updateFilters({
                  risk_tier: filters.risk_tier === tier.tier ? '' : tier.tier,
                })
              }
            >
              <span className="tile__tier">{tier.tier}</span>
              <span className="tile__count">
                {tier.customers.toLocaleString()}
              </span>
              <span className="tile__rate">
                {(tier.historical_churn_rate * 100).toFixed(0)}% churned
                historically
              </span>
            </button>
          ))}
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
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Risk</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Tenure</th>
                  <th scope="col">Contract</th>
                  <th scope="col">Monthly</th>
                  <th scope="col">Outreach</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {customers.data.items.map((customer) => (
                  <tr key={customer.customer_id}>
                    <td>
                      <RiskBadge
                        tier={customer.risk_tier}
                        score={customer.risk_score}
                      />
                    </td>
                    <td>
                      <Link
                        className="table__link"
                        to={`/customers/${customer.customer_id}`}
                      >
                        {customer.customer_id}
                      </Link>
                    </td>
                    <td>
                      {customer.tenure} mo
                      {customer.tenure === 0 && (
                        <span className="table__hint"> (new)</span>
                      )}
                    </td>
                    <td>{customer.contract}</td>
                    <td>${customer.monthly_charges.toFixed(2)}</td>
                    <td>
                      <StatusBadge status={customer.outreach_status} />
                    </td>
                    <td>
                      <Link
                        className="button button--small"
                        to={`/customers/${customer.customer_id}`}
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={customers.data.page}
            totalPages={customers.data.total_pages}
            total={customers.data.total}
            pageSize={customers.data.page_size}
            isFetching={customers.isFetching}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </>
      )}
    </div>
  )
}

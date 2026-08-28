interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  isFetching?: boolean
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  isFetching,
}: Props) {
  if (total === 0) return null

  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__summary">
        {first.toLocaleString()}&ndash;{last.toLocaleString()} of{' '}
        {total.toLocaleString()}
        {isFetching && <span className="pagination__loading"> updating…</span>}
      </span>

      <div className="pagination__controls">
        <button
          className="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="pagination__page">
          Page {page} of {totalPages}
        </span>
        <button
          className="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </nav>
  )
}

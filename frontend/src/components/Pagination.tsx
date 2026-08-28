import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/16/solid'

import { Button } from './ui/button'

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  isFetching?: boolean
}

/**
 * Catalyst's Pagination component is link-based (href only). Paging here is
 * local state rather than a route, so this uses Catalyst Buttons directly to
 * get the same styling with click handlers.
 */
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
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-4"
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {first.toLocaleString()}&ndash;{last.toLocaleString()} of{' '}
        {total.toLocaleString()}
        {isFetching && <span className="italic"> &middot; updating&hellip;</span>}
      </p>

      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <Button
          plain
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ArrowLeftIcon />
          Previous
        </Button>
        <Button
          plain
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ArrowRightIcon />
        </Button>
      </div>
    </nav>
  )
}

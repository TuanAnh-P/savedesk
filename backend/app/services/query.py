"""Server-side filtering, sorting and pagination for the customer list.

Filter, then sort, then slice. Doing this on the server keeps the payload sized
to what the agent is looking at instead of to the dataset.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

from app.models.domain import CustomerRow, OutreachStatus, RiskTier


class SortField(StrEnum):
    RISK_SCORE = "risk_score"
    TENURE = "tenure"
    MONTHLY_CHARGES = "monthly_charges"
    CUSTOMER_ID = "customer_id"


class SortOrder(StrEnum):
    ASC = "asc"
    DESC = "desc"


@dataclass(frozen=True)
class CustomerQuery:
    risk_tier: RiskTier | None = None
    contract: str | None = None
    outreach_status: OutreachStatus | None = None
    min_score: int | None = None
    max_score: int | None = None
    search: str | None = None
    sort_by: SortField = SortField.RISK_SCORE
    order: SortOrder = SortOrder.DESC
    page: int = 1
    page_size: int = 25


@dataclass(frozen=True)
class ListedCustomer:
    row: CustomerRow
    outreach_status: OutreachStatus


@dataclass(frozen=True)
class PageResult:
    items: list[ListedCustomer]
    total: int
    page: int
    page_size: int

    @property
    def total_pages(self) -> int:
        if self.page_size <= 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size


def _matches(row: CustomerRow, status: OutreachStatus, query: CustomerQuery) -> bool:
    """Filters combine with AND; an unset filter is skipped."""
    checks = (
        query.risk_tier is None or row.risk_tier == query.risk_tier,
        query.contract is None or row.contract == query.contract,
        query.outreach_status is None or status == query.outreach_status,
        query.min_score is None or row.risk_score >= query.min_score,
        query.max_score is None or row.risk_score <= query.max_score,
        not query.search or query.search.lower() in row.customer_id.lower(),
    )
    return all(checks)


def _sort_key(field: SortField):
    match field:
        case SortField.RISK_SCORE:
            return lambda item: item.row.risk_score
        case SortField.TENURE:
            return lambda item: item.row.tenure
        case SortField.MONTHLY_CHARGES:
            return lambda item: item.row.monthly_charges
        case SortField.CUSTOMER_ID:
            return lambda item: item.row.customer_id


def run_query(
    rows: list[CustomerRow],
    status_for: dict[str, OutreachStatus],
    query: CustomerQuery,
) -> PageResult:
    """Apply the query and return one page.

    `rows` arrives pre-sorted by risk score descending, so the default view
    skips the sort entirely.
    """
    matched = [
        ListedCustomer(row=row, outreach_status=status_for[row.customer_id])
        for row in rows
        if _matches(row, status_for[row.customer_id], query)
    ]

    already_sorted = (
        query.sort_by is SortField.RISK_SCORE and query.order is SortOrder.DESC
    )
    if not already_sorted:
        matched.sort(key=_sort_key(query.sort_by), reverse=query.order is SortOrder.DESC)

    start = (query.page - 1) * query.page_size
    return PageResult(
        items=matched[start : start + query.page_size],
        total=len(matched),
        page=query.page,
        page_size=query.page_size,
    )

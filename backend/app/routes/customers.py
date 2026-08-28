"""Customer routes: translate HTTP to domain calls and back.

Filtering lives in services/query.py, transition rules in services/outreach.py,
scoring in services/scoring.py.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Path, Query, status

from app.data_access.store import CustomerStore
from app.dependencies import get_store
from app.errors import CustomerNotFoundError, InvalidTransitionProblem
from app.models.api import (
    CustomerDetail,
    CustomerListItem,
    CustomerProfile,
    OutreachOut,
    OutreachTransitionOut,
    OutreachUpdateRequest,
    Page,
    ProblemDetail,
    RiskFactorOut,
)
from app.models.domain import OutreachRecord, OutreachStatus, RiskTier
from app.services.outreach import InvalidTransitionError, allowed_next
from app.services.query import CustomerQuery, SortField, SortOrder, run_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["customers"])

PROBLEM_RESPONSES: dict[int | str, dict] = {
    400: {"model": ProblemDetail, "description": "Invalid query parameter"},
    404: {"model": ProblemDetail, "description": "Customer not found"},
}


def _outreach_out(record: OutreachRecord) -> OutreachOut:
    return OutreachOut(
        status=record.status,
        updated_at=record.updated_at,
        history=[
            OutreachTransitionOut(
                from_status=t.from_status,
                to_status=t.to_status,
                at=t.at,
                note=t.note,
            )
            for t in record.history
        ],
        allowed_next=sorted(allowed_next(record.status), key=lambda s: s.value),
    )


@router.get(
    "",
    response_model=Page[CustomerListItem],
    summary="List customers by risk",
    responses=PROBLEM_RESPONSES,
)
async def list_customers(
    store: CustomerStore = Depends(get_store),
    risk_tier: RiskTier | None = Query(None),
    contract: str | None = Query(None, description="e.g. 'Month-to-month'."),
    outreach_status: OutreachStatus | None = Query(None),
    min_score: int | None = Query(None, ge=0, le=100),
    max_score: int | None = Query(None, ge=0, le=100),
    search: str | None = Query(None, max_length=64, description="Customer ID substring."),
    sort_by: SortField = Query(SortField.RISK_SCORE),
    order: SortOrder = Query(SortOrder.DESC),
    page: int = Query(1, ge=1),
    # Capped here, so an oversized request is rejected before any work happens.
    page_size: int = Query(25, ge=1, le=100),
) -> Page[CustomerListItem]:
    """One page of customers, highest risk first: the first page is the call list."""
    query = CustomerQuery(
        risk_tier=risk_tier,
        contract=contract,
        outreach_status=outreach_status,
        min_score=min_score,
        max_score=max_score,
        search=search,
        sort_by=sort_by,
        order=order,
        page=page,
        page_size=page_size,
    )

    rows = store.rows_by_risk()
    status_for = {r.customer_id: store.outreach_status(r.customer_id) for r in rows}
    result = run_query(rows, status_for, query)

    return Page[CustomerListItem](
        items=[
            CustomerListItem(
                customer_id=item.row.customer_id,
                tenure=item.row.tenure,
                contract=item.row.contract,
                monthly_charges=item.row.monthly_charges,
                risk_score=item.row.risk_score,
                risk_tier=item.row.risk_tier,
                outreach_status=item.outreach_status,
            )
            for item in result.items
        ],
        page=result.page,
        page_size=result.page_size,
        total=result.total,
        total_pages=result.total_pages,
    )


@router.get(
    "/{customer_id}",
    response_model=CustomerDetail,
    summary="Full customer record with score breakdown",
    responses=PROBLEM_RESPONSES,
)
async def get_customer(
    customer_id: str = Path(description="Dataset customer ID, e.g. 7590-VHVEG."),
    store: CustomerStore = Depends(get_store),
) -> CustomerDetail:
    customer = store.get_customer(customer_id)
    if customer is None:
        raise CustomerNotFoundError(customer_id)

    assessment = store.get_assessment(customer_id)
    record = store.get_outreach(customer_id)
    # Both exist whenever the customer does; the store builds all three together.
    assert assessment is not None and record is not None

    return CustomerDetail(
        profile=CustomerProfile.model_validate(customer),
        risk_score=assessment.score,
        risk_tier=assessment.tier,
        factors=[
            RiskFactorOut(
                key=f.key,
                label=f.label,
                observed=f.observed,
                points=f.points,
                max_points=f.max_points,
                rationale=f.rationale,
            )
            for f in assessment.factors
        ],
        outreach=_outreach_out(record),
    )


@router.patch(
    "/{customer_id}/outreach",
    response_model=OutreachOut,
    summary="Update outreach status",
    status_code=status.HTTP_200_OK,
    responses={
        **PROBLEM_RESPONSES,
        409: {
            "model": ProblemDetail,
            "description": "Transition not allowed from the current status",
        },
    },
)
async def update_outreach(
    payload: OutreachUpdateRequest,
    customer_id: str = Path(description="Dataset customer ID."),
    store: CustomerStore = Depends(get_store),
) -> OutreachOut:
    """Move a customer to a new outreach status, if the state machine allows it."""
    try:
        record = store.update_outreach(customer_id, payload.status, payload.note)
    except KeyError:
        raise CustomerNotFoundError(customer_id) from None
    except InvalidTransitionError as exc:
        # Info, not error: this is the state machine working as intended.
        logger.info(
            "Rejected outreach transition",
            extra={
                "customer_id": customer_id,
                "from_status": exc.current.value,
                "to_status": exc.requested.value,
            },
        )
        raise InvalidTransitionProblem(str(exc)) from exc

    logger.info(
        "Outreach status updated",
        extra={"customer_id": customer_id, "to_status": record.status.value},
    )
    return _outreach_out(record)

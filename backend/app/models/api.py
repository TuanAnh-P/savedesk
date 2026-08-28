"""API request and response schemas.

Separate from the domain types so the wire format can change independently, and
so fields like the churn label cannot leak into a response by accident.
"""

from __future__ import annotations

from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.models.domain import OutreachStatus, RiskTier

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int = Field(description="Rows matching the filters, not just this page.")
    total_pages: int


class CustomerListItem(BaseModel):
    """One list row. Lean by design; the full record is on the detail endpoint."""

    customer_id: str
    tenure: int
    contract: str
    monthly_charges: float
    risk_score: int
    risk_tier: RiskTier
    outreach_status: OutreachStatus


class RiskFactorOut(BaseModel):
    key: str
    label: str
    observed: str = Field(description="This customer's value for the factor.")
    points: int
    max_points: int
    rationale: str


class OutreachTransitionOut(BaseModel):
    from_status: OutreachStatus
    to_status: OutreachStatus
    at: datetime
    note: str | None = None


class OutreachOut(BaseModel):
    status: OutreachStatus
    updated_at: datetime | None = None
    history: list[OutreachTransitionOut] = []
    allowed_next: list[OutreachStatus] = Field(
        default=[],
        description="States this customer may move to next; the UI offers only these.",
    )


class CustomerProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: str
    gender: str
    senior_citizen: bool
    partner: bool
    dependents: bool
    tenure: int
    phone_service: bool
    multiple_lines: str
    internet_service: str
    online_security: str
    online_backup: str
    device_protection: str
    tech_support: str
    streaming_tv: str
    streaming_movies: str
    contract: str
    paperless_billing: bool
    payment_method: str
    monthly_charges: float
    total_charges: float


class CustomerDetail(BaseModel):
    profile: CustomerProfile
    risk_score: int
    risk_tier: RiskTier
    factors: list[RiskFactorOut]
    outreach: OutreachOut


class OutreachUpdateRequest(BaseModel):
    # extra="forbid": a client cannot send fields the server never meant to accept.
    model_config = ConfigDict(extra="forbid")

    status: OutreachStatus
    note: str | None = Field(default=None, max_length=500)


class ProblemDetail(BaseModel):
    """RFC 9457 error response, declared so it appears in the OpenAPI docs."""

    type: str
    title: str
    status: int
    detail: str
    instance: str | None = None
    request_id: str | None = None

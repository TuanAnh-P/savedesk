"""Internal domain types, kept free of FastAPI so services stay unit testable."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class RiskTier(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class OutreachStatus(StrEnum):
    NOT_CONTACTED = "NOT_CONTACTED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    UNREACHABLE = "UNREACHABLE"


@dataclass(frozen=True)
class Customer:
    """One dataset row, typed and normalised.

    Frozen: customer data is loaded once and never changes. Outreach state,
    which does change, lives separately in OutreachRecord.
    """

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

    # Historical outcome, used only to measure tier separation on /model/info.
    # Never an input to the score, never returned for an individual customer.
    churned: bool


@dataclass(frozen=True)
class RiskFactor:
    """One factor's contribution. Factors sum to the score, which is what makes
    the score explainable."""

    key: str
    label: str
    observed: str
    points: int
    max_points: int
    rationale: str


@dataclass(frozen=True)
class RiskAssessment:
    score: int
    tier: RiskTier
    factors: tuple[RiskFactor, ...]

    @property
    def contributing_factors(self) -> tuple[RiskFactor, ...]:
        """Only factors that added points, highest first."""
        return tuple(
            sorted(
                (f for f in self.factors if f.points > 0),
                key=lambda f: f.points,
                reverse=True,
            )
        )


@dataclass(frozen=True)
class OutreachTransition:
    from_status: OutreachStatus
    to_status: OutreachStatus
    at: datetime
    note: str | None = None


@dataclass
class OutreachRecord:
    status: OutreachStatus = OutreachStatus.NOT_CONTACTED
    updated_at: datetime | None = None
    history: list[OutreachTransition] = field(default_factory=list)


@dataclass(frozen=True)
class CustomerRow:
    """Lean projection for the list endpoint: the six columns the table shows."""

    customer_id: str
    tenure: int
    contract: str
    monthly_charges: float
    risk_score: int
    risk_tier: RiskTier

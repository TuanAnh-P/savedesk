"""Risk scoring: a transparent stand-in for the data science team's model.

Weights come from measuring the bundled dataset: each factor's churn rate
against the 26.5% base rate. The model is additive so each factor's contribution
can be shown separately, which is what the console's "why" panel needs.

RULES is the single source of truth. score_customer and /model/info both read
it, so the weights the UI explains cannot drift from the weights applied.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.models.domain import Customer, RiskAssessment, RiskFactor, RiskTier

SCORING_MODEL_VERSION = "1.0.0"

TIER_THRESHOLDS: tuple[tuple[RiskTier, int], ...] = (
    (RiskTier.CRITICAL, 70),
    (RiskTier.HIGH, 50),
    (RiskTier.MEDIUM, 30),
    (RiskTier.LOW, 0),
)

MAX_SCORE = 100


@dataclass(frozen=True)
class FactorRule:
    """One rule. `evaluate` scores a customer; `bands` is the same rule as
    display data for /model/info."""

    key: str
    label: str
    rationale: str
    max_points: int
    bands: tuple[tuple[str, int], ...]
    evaluate: Callable[[Customer], tuple[str, int]]


def _tenure(c: Customer) -> tuple[str, int]:
    months = c.tenure
    label = f"{months} month{'s' if months != 1 else ''}"
    if months <= 6:
        return label, 25
    if months <= 12:
        return label, 15
    if months <= 24:
        return label, 8
    if months <= 48:
        return label, 3
    return label, 0


def _contract(c: Customer) -> tuple[str, int]:
    points = {"Month-to-month": 20, "One year": 6, "Two year": 0}
    return c.contract, points.get(c.contract, 0)


def _payment_method(c: Customer) -> tuple[str, int]:
    points = {"Electronic check": 15, "Mailed check": 5}
    return c.payment_method, points.get(c.payment_method, 0)


def _internet_service(c: Customer) -> tuple[str, int]:
    points = {"Fiber optic": 12, "DSL": 4}
    return c.internet_service, points.get(c.internet_service, 0)


def _tech_support(c: Customer) -> tuple[str, int]:
    # "No internet service" scores zero: a customer who cannot buy the add-on
    # should not be penalised for lacking it.
    return c.tech_support, 8 if c.tech_support == "No" else 0


def _online_security(c: Customer) -> tuple[str, int]:
    return c.online_security, 8 if c.online_security == "No" else 0


def _senior_citizen(c: Customer) -> tuple[str, int]:
    return ("Yes" if c.senior_citizen else "No"), 4 if c.senior_citizen else 0


def _monthly_charges(c: Customer) -> tuple[str, int]:
    # Churn peaks in the $70-95 band and eases above it, so this is banded, not
    # scaled linearly.
    amount = f"${c.monthly_charges:.2f}"
    if c.monthly_charges >= 70:
        return amount, 4
    if c.monthly_charges >= 35:
        return amount, 1
    return amount, 0


def _partner(c: Customer) -> tuple[str, int]:
    return ("Yes" if c.partner else "No"), 0 if c.partner else 2


def _dependents(c: Customer) -> tuple[str, int]:
    return ("Yes" if c.dependents else "No"), 0 if c.dependents else 2


RULES: tuple[FactorRule, ...] = (
    FactorRule(
        key="tenure",
        label="Tenure",
        rationale=(
            "New customers churn most. The first six months carry a 52.9% churn "
            "rate against a 26.5% average; risk falls steadily after that."
        ),
        max_points=25,
        bands=(
            ("6 months or less", 25),
            ("7-12 months", 15),
            ("13-24 months", 8),
            ("25-48 months", 3),
            ("49+ months", 0),
        ),
        evaluate=_tenure,
    ),
    FactorRule(
        key="contract",
        label="Contract type",
        rationale=(
            "A month-to-month customer can leave at any time and churns at "
            "42.7%. A two-year contract churns at 2.8%."
        ),
        max_points=20,
        bands=(("Month-to-month", 20), ("One year", 6), ("Two year", 0)),
        evaluate=_contract,
    ),
    FactorRule(
        key="payment_method",
        label="Payment method",
        rationale=(
            "Electronic check users churn at 45.3%, the highest of any single "
            "group. Automatic payment methods sit well below average."
        ),
        max_points=15,
        bands=(
            ("Electronic check", 15),
            ("Mailed check", 5),
            ("Bank transfer (automatic)", 0),
            ("Credit card (automatic)", 0),
        ),
        evaluate=_payment_method,
    ),
    FactorRule(
        key="internet_service",
        label="Internet service",
        rationale=(
            "Fiber optic customers churn at 41.9% despite paying for the "
            "premium product, which usually signals unmet expectations."
        ),
        max_points=12,
        bands=(("Fiber optic", 12), ("DSL", 4), ("No internet", 0)),
        evaluate=_internet_service,
    ),
    FactorRule(
        key="tech_support",
        label="Tech support",
        rationale=(
            "Customers without tech support churn at 41.6% versus 15.2% with "
            "it. No support line means no route to fix a problem."
        ),
        max_points=8,
        bands=(("No", 8), ("Yes", 0), ("No internet service", 0)),
        evaluate=_tech_support,
    ),
    FactorRule(
        key="online_security",
        label="Online security",
        rationale=(
            "Churn is 41.8% without online security versus 14.6% with it. Each "
            "add-on is another reason to stay."
        ),
        max_points=8,
        bands=(("No", 8), ("Yes", 0), ("No internet service", 0)),
        evaluate=_online_security,
    ),
    FactorRule(
        key="senior_citizen",
        label="Senior citizen",
        rationale="Senior accounts churn at 41.7% versus 23.6% for everyone else.",
        max_points=4,
        bands=(("Yes", 4), ("No", 0)),
        evaluate=_senior_citizen,
    ),
    FactorRule(
        key="monthly_charges",
        label="Monthly charges",
        rationale=(
            "Churn climbs with the monthly bill and peaks in the $70-95 band at "
            "37.3%, against 10.9% for bills under $35."
        ),
        max_points=4,
        bands=(("$70 or more", 4), ("$35-$70", 1), ("Under $35", 0)),
        evaluate=_monthly_charges,
    ),
    FactorRule(
        key="partner",
        label="Partner",
        rationale="Customers without a partner churn at 33.0% versus 19.7%.",
        max_points=2,
        bands=(("No", 2), ("Yes", 0)),
        evaluate=_partner,
    ),
    FactorRule(
        key="dependents",
        label="Dependents",
        rationale="Customers without dependents churn at 31.3% versus 15.5%.",
        max_points=2,
        bands=(("No", 2), ("Yes", 0)),
        evaluate=_dependents,
    ),
)

# The weights are chosen to total exactly MAX_SCORE, so a score is always the
# plain sum of its factors and never needs capping. That is what lets the
# console promise that the breakdown reconciles with the number beside it.
# Enforced here so a future weight change cannot quietly break it.
assert sum(rule.max_points for rule in RULES) == MAX_SCORE, (
    f"Factor weights total {sum(r.max_points for r in RULES)}, expected {MAX_SCORE}."
)

# Gender is excluded: no signal (1.01x lift) and not an acceptable basis for
# deciding who gets contacted.
EXCLUDED_FIELDS: tuple[tuple[str, str], ...] = (
    (
        "gender",
        "No predictive signal (26.9% vs 26.2% churn, 1.01x lift) and not an "
        "appropriate basis for prioritising customers.",
    ),
)


def tier_for_score(score: int) -> RiskTier:
    for tier, threshold in TIER_THRESHOLDS:
        if score >= threshold:
            return tier
    return RiskTier.LOW


def score_customer(customer: Customer) -> RiskAssessment:
    """Score one customer, returning every factor including the zero-point ones.

    The score is the plain sum of the factor points. Because the weights total
    MAX_SCORE (asserted above), no clamping is needed and the breakdown always
    reconciles with the score for every customer.
    """
    factors: list[RiskFactor] = []
    score = 0

    for rule in RULES:
        observed, points = rule.evaluate(customer)
        score += points
        factors.append(
            RiskFactor(
                key=rule.key,
                label=rule.label,
                observed=observed,
                points=points,
                max_points=rule.max_points,
                rationale=rule.rationale,
            )
        )

    return RiskAssessment(score=score, tier=tier_for_score(score), factors=tuple(factors))


def describe_model() -> dict:
    """The ruleset as data, for GET /model/info."""
    return {
        "version": SCORING_MODEL_VERSION,
        "method": "rule_based_additive",
        "max_score": MAX_SCORE,
        "tiers": [
            {"tier": tier.value, "min_score": threshold}
            for tier, threshold in TIER_THRESHOLDS
        ],
        "factors": [
            {
                "key": rule.key,
                "label": rule.label,
                "rationale": rule.rationale,
                "max_points": rule.max_points,
                "bands": [
                    {"condition": condition, "points": points}
                    for condition, points in rule.bands
                ],
            }
            for rule in RULES
        ],
        "excluded_fields": [
            {"field": field, "reason": reason} for field, reason in EXCLUDED_FIELDS
        ],
    }

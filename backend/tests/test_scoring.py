"""Tests for the risk scoring heuristic."""

from __future__ import annotations

import pytest

from app.models.domain import RiskTier
from app.services.scoring import (
    MAX_SCORE,
    RULES,
    describe_model,
    score_customer,
    tier_for_score,
)
from tests.conftest import make_customer, make_high_risk_customer


class TestTierBoundaries:
    @pytest.mark.parametrize(
        ("score", "expected"),
        [
            (0, RiskTier.LOW),
            (29, RiskTier.LOW),
            (30, RiskTier.MEDIUM),
            (49, RiskTier.MEDIUM),
            (50, RiskTier.HIGH),
            (69, RiskTier.HIGH),
            (70, RiskTier.CRITICAL),
            (100, RiskTier.CRITICAL),
        ],
    )
    def test_tier_for_score(self, score: int, expected: RiskTier) -> None:
        """Both sides of every threshold: a point either side changes the queue."""
        assert tier_for_score(score) == expected


class TestFactorContributions:
    @pytest.mark.parametrize(
        ("field", "value", "expected_points"),
        [
            ("tenure", 3, 25),
            ("tenure", 9, 15),
            ("tenure", 18, 8),
            ("tenure", 36, 3),
            ("tenure", 60, 0),
            ("contract", "Month-to-month", 20),
            ("contract", "One year", 6),
            ("contract", "Two year", 0),
            ("payment_method", "Electronic check", 15),
            ("payment_method", "Mailed check", 5),
            ("payment_method", "Bank transfer (automatic)", 0),
            ("internet_service", "Fiber optic", 12),
            ("internet_service", "DSL", 4),
            ("internet_service", "No", 0),
            ("senior_citizen", True, 4),
            ("senior_citizen", False, 0),
            ("monthly_charges", 95.0, 4),
            ("monthly_charges", 50.0, 1),
            ("monthly_charges", 20.0, 0),
        ],
    )
    def test_single_factor_points(
        self, field: str, value: object, expected_points: int
    ) -> None:
        # The baseline scores 0, so the assertion isolates one factor.
        assert score_customer(make_customer()).score == 0

        assessment = score_customer(make_customer(**{field: value}))
        factor = next(f for f in assessment.factors if f.key == field)
        assert factor.points == expected_points

    def test_addons_only_penalised_when_internet_is_available(self) -> None:
        """A customer with no internet cannot buy tech support or online
        security, so they must not be scored for lacking them."""
        no_internet = make_customer(
            internet_service="No",
            tech_support="No internet service",
            online_security="No internet service",
        )
        factors = {f.key: f.points for f in score_customer(no_internet).factors}
        assert factors["tech_support"] == 0
        assert factors["online_security"] == 0

        with_internet = make_customer(
            internet_service="DSL", tech_support="No", online_security="No"
        )
        factors = {f.key: f.points for f in score_customer(with_internet).factors}
        assert factors["tech_support"] == 8
        assert factors["online_security"] == 8


class TestScoreIntegrity:
    def test_breakdown_sums_to_score(self) -> None:
        """The "why" panel must add up to the number displayed next to it."""
        for customer in (
            make_customer(),
            make_customer(tenure=1, contract="Month-to-month"),
            make_customer(tenure=30, internet_service="DSL", online_security="No"),
        ):
            assessment = score_customer(customer)
            assert sum(f.points for f in assessment.factors) == assessment.score

    def test_weights_total_the_maximum_score(self) -> None:
        """The reason no clamping is needed.

        An earlier version had the weights totalling 106 against a cap of 100,
        so the worst-affected customers displayed a score their own breakdown
        contradicted. Pinning the total here is what stops that returning.
        """
        assert sum(rule.max_points for rule in RULES) == MAX_SCORE

    def test_worst_case_customer_scores_exactly_the_maximum(self) -> None:
        assessment = score_customer(make_high_risk_customer())
        assert assessment.score == MAX_SCORE
        assert sum(f.points for f in assessment.factors) == MAX_SCORE
        assert assessment.tier is RiskTier.CRITICAL

    def test_gender_never_affects_the_score(self) -> None:
        """Stops the exclusion being undone by a later tuning pass."""
        for gender in ("Female", "Male", "Other", ""):
            assert score_customer(make_customer(gender=gender)).score == 0
        assert "gender" not in {rule.key for rule in RULES}

    def test_churn_label_never_affects_the_score(self) -> None:
        assert (
            score_customer(make_customer(churned=False)).score
            == score_customer(make_customer(churned=True)).score
        )

    def test_new_customer_with_zero_charges_scores_without_error(self) -> None:
        """The 11 blank-TotalCharges rows arrive here as 0.0."""
        assessment = score_customer(make_customer(tenure=0, total_charges=0.0))
        assert assessment.score > 0

    def test_contributing_factors_excludes_zeros_and_sorts_by_impact(self) -> None:
        contributing = score_customer(make_high_risk_customer()).contributing_factors
        assert all(f.points > 0 for f in contributing)
        points = [f.points for f in contributing]
        assert points == sorted(points, reverse=True)


class TestModelDescription:
    def test_describes_every_rule(self) -> None:
        described = describe_model()
        assert {f["key"] for f in described["factors"]} == {r.key for r in RULES}

    def test_published_weights_match_the_rules_applied(self) -> None:
        """/model/info is what the UI explains from, so it cannot overstate."""
        described = {f["key"]: f for f in describe_model()["factors"]}
        for rule in RULES:
            assert described[rule.key]["max_points"] == rule.max_points
            top_band = max(b["points"] for b in described[rule.key]["bands"])
            assert top_band == rule.max_points

    def test_documents_the_gender_exclusion(self) -> None:
        excluded = {e["field"] for e in describe_model()["excluded_fields"]}
        assert "gender" in excluded

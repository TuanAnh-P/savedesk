"""CSV loading and the in-memory store.

The only module that knows the data comes from a CSV. Customers are immutable
and scored once at startup; outreach state is the one mutable structure and is
guarded by a lock.
"""

from __future__ import annotations

import csv
import logging
import threading
from datetime import UTC, datetime
from pathlib import Path

from app.models.domain import (
    Customer,
    CustomerRow,
    OutreachRecord,
    OutreachStatus,
    OutreachTransition,
    RiskAssessment,
    RiskTier,
)
from app.services.outreach import validate_transition
from app.services.scoring import score_customer

logger = logging.getLogger(__name__)

_TRUTHY = {"yes", "1", "true"}


class DatasetError(RuntimeError):
    """Raised when the dataset cannot be loaded or is unusable."""


def _to_bool(value: str) -> bool:
    return value.strip().lower() in _TRUTHY


def _parse_total_charges(raw: str, tenure: int, customer_id: str) -> tuple[float, bool]:
    """Parse TotalCharges. Returns the value and whether the blank was unexpected.

    11 rows in the bundled dataset have a blank here, and all 11 have tenure 0:
    they signed up but have not been billed yet, so the blank means zero, not
    missing. A blank with tenure > 0 is genuinely missing and gets flagged.
    """
    text = raw.strip()
    if text:
        try:
            return float(text), False
        except ValueError:
            logger.warning(
                "Unparseable TotalCharges for %s: %r. Defaulting to 0.0.",
                customer_id,
                raw,
            )
            return 0.0, True

    return 0.0, tenure > 0


def _row_to_customer(row: dict[str, str]) -> tuple[Customer, bool]:
    customer_id = row["customerID"].strip()
    tenure = int(row["tenure"])
    total_charges, unexpected_blank = _parse_total_charges(
        row["TotalCharges"], tenure, customer_id
    )

    customer = Customer(
        customer_id=customer_id,
        gender=row["gender"].strip(),
        senior_citizen=_to_bool(row["SeniorCitizen"]),
        partner=_to_bool(row["Partner"]),
        dependents=_to_bool(row["Dependents"]),
        tenure=tenure,
        phone_service=_to_bool(row["PhoneService"]),
        multiple_lines=row["MultipleLines"].strip(),
        internet_service=row["InternetService"].strip(),
        online_security=row["OnlineSecurity"].strip(),
        online_backup=row["OnlineBackup"].strip(),
        device_protection=row["DeviceProtection"].strip(),
        tech_support=row["TechSupport"].strip(),
        streaming_tv=row["StreamingTV"].strip(),
        streaming_movies=row["StreamingMovies"].strip(),
        contract=row["Contract"].strip(),
        paperless_billing=_to_bool(row["PaperlessBilling"]),
        payment_method=row["PaymentMethod"].strip(),
        monthly_charges=float(row["MonthlyCharges"]),
        total_charges=total_charges,
        churned=_to_bool(row["Churn"]),
    )
    return customer, unexpected_blank


class CustomerStore:
    """In-memory store of customers, their scores, and their outreach state."""

    def __init__(self, customers: list[Customer]) -> None:
        if not customers:
            raise DatasetError("Dataset contained no customers.")

        self._customers: dict[str, Customer] = {c.customer_id: c for c in customers}
        if len(self._customers) != len(customers):
            raise DatasetError("Dataset contained duplicate customer IDs.")

        # Scored once: the rules are deterministic and the inputs never change.
        self._assessments: dict[str, RiskAssessment] = {
            c.customer_id: score_customer(c) for c in customers
        }

        self._outreach: dict[str, OutreachRecord] = {
            c.customer_id: OutreachRecord() for c in customers
        }
        self._lock = threading.Lock()

        # Pre-sorted by score: this is the default view, so the common request
        # needs no sort at all.
        self._rows_by_risk: list[CustomerRow] = [
            CustomerRow(
                customer_id=c.customer_id,
                tenure=c.tenure,
                contract=c.contract,
                monthly_charges=c.monthly_charges,
                risk_score=self._assessments[c.customer_id].score,
                risk_tier=self._assessments[c.customer_id].tier,
            )
            for c in customers
        ]
        self._rows_by_risk.sort(key=lambda r: r.risk_score, reverse=True)

    def __len__(self) -> int:
        return len(self._customers)

    def get_customer(self, customer_id: str) -> Customer | None:
        return self._customers.get(customer_id)

    def get_assessment(self, customer_id: str) -> RiskAssessment | None:
        return self._assessments.get(customer_id)

    def rows_by_risk(self) -> list[CustomerRow]:
        """All rows, highest risk first. Callers must not mutate the result."""
        return self._rows_by_risk

    def get_outreach(self, customer_id: str) -> OutreachRecord | None:
        with self._lock:
            record = self._outreach.get(customer_id)
            if record is None:
                return None
            # A copy, so callers cannot mutate store state by accident.
            return OutreachRecord(
                status=record.status,
                updated_at=record.updated_at,
                history=list(record.history),
            )

    def outreach_status(self, customer_id: str) -> OutreachStatus | None:
        with self._lock:
            record = self._outreach.get(customer_id)
            return record.status if record else None

    def update_outreach(
        self, customer_id: str, requested: OutreachStatus, note: str | None = None
    ) -> OutreachRecord:
        """Validate and apply a status change.

        Read, check and write happen under one lock: validating outside it would
        let two concurrent requests both read NOT_CONTACTED and both write.

        Raises KeyError for an unknown customer, InvalidTransitionError for an
        illegal move.
        """
        with self._lock:
            record = self._outreach.get(customer_id)
            if record is None:
                raise KeyError(customer_id)

            validate_transition(record.status, requested)

            now = datetime.now(UTC)
            record.history.append(
                OutreachTransition(
                    from_status=record.status,
                    to_status=requested,
                    at=now,
                    note=note,
                )
            )
            record.status = requested
            record.updated_at = now
            return OutreachRecord(
                status=record.status,
                updated_at=record.updated_at,
                history=list(record.history),
            )

    def tier_validation(self) -> list[dict]:
        """Each tier's historical churn rate, for /model/info.

        Uses the dataset's outcome label, which is used here and nowhere else.
        """
        buckets: dict[RiskTier, list[int]] = {tier: [0, 0] for tier in RiskTier}
        for customer in self._customers.values():
            tier = self._assessments[customer.customer_id].tier
            buckets[tier][0] += int(customer.churned)
            buckets[tier][1] += 1

        total = len(self._customers)
        order = [RiskTier.CRITICAL, RiskTier.HIGH, RiskTier.MEDIUM, RiskTier.LOW]
        return [
            {
                "tier": tier.value,
                "customers": buckets[tier][1],
                "share_of_book": round(buckets[tier][1] / total, 4),
                "historical_churn_rate": (
                    round(buckets[tier][0] / buckets[tier][1], 4)
                    if buckets[tier][1]
                    else 0.0
                ),
            }
            for tier in order
        ]


def load_customers(csv_path: Path) -> list[Customer]:
    """Read and parse the dataset.

    Fails loudly: a service that starts and then 500s on every request is harder
    to diagnose than one that refuses to start and says why.
    """
    if not csv_path.exists():
        raise DatasetError(
            f"Dataset not found at {csv_path}. Expected the bundled CSV in data/."
        )

    customers: list[Customer] = []
    expected_blanks = 0
    unexpected_blanks = 0

    try:
        with csv_path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            for line_number, row in enumerate(reader, start=2):
                try:
                    customer, unexpected = _row_to_customer(row)
                except (KeyError, ValueError) as exc:
                    # One bad row should not take down the dataset, but it must
                    # be visible instead of silently dropped.
                    logger.warning("Skipping row %d: %s", line_number, exc)
                    continue

                if not row["TotalCharges"].strip():
                    if unexpected:
                        unexpected_blanks += 1
                    else:
                        expected_blanks += 1
                customers.append(customer)
    except OSError as exc:
        raise DatasetError(f"Could not read dataset at {csv_path}: {exc}") from exc

    if expected_blanks:
        logger.info(
            "Recorded TotalCharges as 0.00 for %d customers with tenure 0 "
            "(signed up, not yet billed).",
            expected_blanks,
        )
    if unexpected_blanks:
        logger.warning(
            "%d customers had a blank TotalCharges despite tenure > 0. "
            "Defaulted to 0.00; this is unexpected and worth investigating.",
            unexpected_blanks,
        )

    logger.info("Loaded %d customers from %s", len(customers), csv_path)
    return customers


def build_store(csv_path: Path) -> CustomerStore:
    return CustomerStore(load_customers(csv_path))

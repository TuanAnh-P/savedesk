"""Tests for CSV loading and the in-memory store.

These read the real dataset, to prove the bundled file parses and its known
quirks are handled deliberately.
"""

from __future__ import annotations

import threading

import pytest

from app.config import settings
from app.data_access.store import (
    CustomerStore,
    DatasetError,
    _parse_total_charges,
    build_store,
    load_customers,
)
from app.models.domain import OutreachStatus
from app.services.outreach import InvalidTransitionError
from tests.conftest import make_customer


class TestTotalChargesParsing:
    def test_blank_on_a_new_customer_is_zero_and_expected(self) -> None:
        assert _parse_total_charges("", tenure=0, customer_id="X") == (0.0, False)

    def test_blank_on_an_established_customer_is_flagged(self) -> None:
        """A customer billed for 12 months should have a total, so this one is
        genuinely missing and must be visible in the logs."""
        assert _parse_total_charges("", tenure=12, customer_id="X") == (0.0, True)

    def test_normal_values_parse(self) -> None:
        assert _parse_total_charges("1889.5", tenure=34, customer_id="X") == (
            1889.5,
            False,
        )

    def test_unparseable_value_is_flagged_rather_than_crashing(self) -> None:
        assert _parse_total_charges("n/a", tenure=5, customer_id="X") == (0.0, True)


class TestLoadingTheBundledDataset:
    def test_loads_every_row_with_unique_ids(self) -> None:
        customers = load_customers(settings.csv_path)
        assert len(customers) == 7043
        assert len({c.customer_id for c in customers}) == 7043

    def test_the_eleven_blank_rows_are_all_new_customers(self) -> None:
        """The diagnosis behind treating the blanks as zero."""
        zero_total = [
            c for c in load_customers(settings.csv_path) if c.total_charges == 0.0
        ]
        assert len(zero_total) == 11
        assert all(c.tenure == 0 for c in zero_total)

    def test_missing_file_fails_loudly(self, tmp_path) -> None:
        with pytest.raises(DatasetError, match="not found"):
            load_customers(tmp_path / "absent.csv")

    def test_malformed_rows_are_skipped_not_fatal(self, tmp_path) -> None:
        csv_file = tmp_path / "partial.csv"
        header = (
            "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,"
            "MultipleLines,InternetService,OnlineSecurity,OnlineBackup,DeviceProtection,"
            "TechSupport,StreamingTV,StreamingMovies,Contract,PaperlessBilling,"
            "PaymentMethod,MonthlyCharges,TotalCharges,Churn"
        )
        good = (
            "0001-GOOD,Female,0,Yes,No,12,Yes,No,DSL,No,Yes,No,No,No,No,"
            "One year,Yes,Mailed check,50.0,600.0,No"
        )
        bad = good.replace("0001-GOOD", "0002-BAD").replace(",12,", ",NOT_A_NUMBER,")
        csv_file.write_text("\n".join([header, good, bad]) + "\n")

        assert [c.customer_id for c in load_customers(csv_file)] == ["0001-GOOD"]


class TestStoreBehaviour:
    def test_rejects_an_empty_dataset(self) -> None:
        with pytest.raises(DatasetError, match="no customers"):
            CustomerStore([])

    def test_rejects_duplicate_ids(self) -> None:
        with pytest.raises(DatasetError, match="duplicate"):
            CustomerStore([make_customer("DUP-0001"), make_customer("DUP-0001")])

    def test_rows_are_pre_sorted_by_risk(self) -> None:
        scores = [r.risk_score for r in build_store(settings.csv_path).rows_by_risk()]
        assert scores == sorted(scores, reverse=True)

    def test_unknown_customer_returns_none(self) -> None:
        store = CustomerStore([make_customer("0001-TEST")])
        assert store.get_customer("NOPE") is None
        assert store.outreach_status("NOPE") is None

    def test_every_customer_starts_not_contacted(self) -> None:
        store = CustomerStore([make_customer("0001-TEST")])
        assert store.outreach_status("0001-TEST") is OutreachStatus.NOT_CONTACTED

    def test_returned_outreach_record_is_a_copy(self) -> None:
        """Callers must not mutate store state through what a getter returned."""
        store = CustomerStore([make_customer("0001-TEST")])
        record = store.get_outreach("0001-TEST")
        record.status = OutreachStatus.RESOLVED
        record.history.append("nonsense")

        assert store.outreach_status("0001-TEST") is OutreachStatus.NOT_CONTACTED
        assert store.get_outreach("0001-TEST").history == []

    def test_update_validates_against_the_state_machine(self) -> None:
        store = CustomerStore([make_customer("0001-TEST")])
        with pytest.raises(InvalidTransitionError):
            store.update_outreach("0001-TEST", OutreachStatus.RESOLVED)

    def test_update_on_unknown_customer_raises_key_error(self) -> None:
        store = CustomerStore([make_customer("0001-TEST")])
        with pytest.raises(KeyError):
            store.update_outreach("NOPE", OutreachStatus.IN_PROGRESS)

    def test_concurrent_updates_produce_one_winner(self) -> None:
        """Check and write share a lock, so only one racing request can move a
        customer out of NOT_CONTACTED."""
        store = CustomerStore([make_customer("0001-TEST")])
        successes = []

        def attempt() -> None:
            try:
                store.update_outreach("0001-TEST", OutreachStatus.IN_PROGRESS)
                successes.append(True)
            except InvalidTransitionError:
                pass

        threads = [threading.Thread(target=attempt) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        assert len(successes) == 1
        assert len(store.get_outreach("0001-TEST").history) == 1


class TestTierValidation:
    def test_tiers_separate_on_historical_churn(self) -> None:
        """The heuristic's headline claim, measured. If a weight change broke
        the ranking, this fails."""
        rates = {
            row["tier"]: row["historical_churn_rate"]
            for row in build_store(settings.csv_path).tier_validation()
        }
        assert rates["CRITICAL"] > rates["HIGH"] > rates["MEDIUM"] > rates["LOW"]
        assert rates["CRITICAL"] > 0.5
        assert rates["LOW"] < 0.05

    def test_shares_of_book_sum_to_one(self) -> None:
        total = sum(
            row["share_of_book"]
            for row in build_store(settings.csv_path).tier_validation()
        )
        assert total == pytest.approx(1.0, abs=0.001)

"""Shared test fixtures.

API tests run against a small hand-built store, so assertions stay deterministic
and do not depend on the contents of the real CSV.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.data_access.store import CustomerStore
from app.dependencies import get_store
from app.main import app
from app.models.domain import Customer


def make_customer(customer_id: str = "0001-TEST", **overrides) -> Customer:
    """A customer scoring 0, so a test can change one field and assert its effect."""
    base = {
        "customer_id": customer_id,
        "gender": "Female",
        "senior_citizen": False,
        "partner": True,
        "dependents": True,
        "tenure": 72,
        "phone_service": True,
        "multiple_lines": "No",
        "internet_service": "No",
        "online_security": "No internet service",
        "online_backup": "No internet service",
        "device_protection": "No internet service",
        "tech_support": "No internet service",
        "streaming_tv": "No internet service",
        "streaming_movies": "No internet service",
        "contract": "Two year",
        "paperless_billing": False,
        "payment_method": "Credit card (automatic)",
        "monthly_charges": 20.0,
        "total_charges": 1440.0,
        "churned": False,
    }
    base.update(overrides)
    return Customer(**base)


def make_high_risk_customer(customer_id: str = "0002-RISK") -> Customer:
    """Triggers every scoring factor."""
    return make_customer(
        customer_id=customer_id,
        senior_citizen=True,
        partner=False,
        dependents=False,
        tenure=2,
        internet_service="Fiber optic",
        online_security="No",
        tech_support="No",
        contract="Month-to-month",
        payment_method="Electronic check",
        monthly_charges=95.0,
        total_charges=190.0,
        churned=True,
    )


@pytest.fixture
def store() -> CustomerStore:
    return CustomerStore(
        [
            make_customer("0001-LOWRK"),
            make_high_risk_customer("0002-RISK"),
            make_customer("0003-MIDRK", tenure=10, contract="Month-to-month"),
        ]
    )


@pytest.fixture
def client(store: CustomerStore) -> TestClient:
    """Not used as a context manager: that would run the lifespan and load the
    real CSV. Overriding get_store keeps these tests off the dataset."""
    app.dependency_overrides[get_store] = lambda: store
    yield TestClient(app)
    app.dependency_overrides.clear()

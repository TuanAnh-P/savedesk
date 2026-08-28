"""Route dependencies.

Routes take the store via Depends so tests can inject a fixture store without
patching module globals.
"""

from __future__ import annotations

from fastapi import Request

from app.data_access.store import CustomerStore
from app.errors import DatasetUnavailableError


def get_store(request: Request) -> CustomerStore:
    store: CustomerStore | None = getattr(request.app.state, "store", None)
    if store is None:
        raise DatasetUnavailableError(
            "The customer dataset is not loaded. The service is not ready."
        )
    return store

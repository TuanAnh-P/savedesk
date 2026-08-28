"""Model and health routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.data_access.store import CustomerStore
from app.dependencies import get_store
from app.services.outreach import describe_workflow
from app.services.scoring import describe_model

router = APIRouter(tags=["model"])


@router.get("/model/info", summary="Scoring rules, weights and measured accuracy")
async def model_info(store: CustomerStore = Depends(get_store)) -> dict:
    """The ruleset, the outreach workflow, and how well the tiers separate.

    The frontend renders its "why" panel from this instead of hardcoding
    weights, so the UI and the API cannot disagree.
    """
    return {
        "scoring": describe_model(),
        "workflow": describe_workflow(),
        "validation": {
            "dataset_size": len(store),
            "note": (
                "Historical churn rates measured on the bundled dataset. The "
                "outcome label is used only for this measurement: it is never "
                "an input to the score and is never returned per customer."
            ),
            "tiers": store.tier_validation(),
        },
    }


@router.get("/health", summary="Liveness and readiness")
async def health(store: CustomerStore = Depends(get_store)) -> dict:
    """Depends on the store, so it fails while the dataset is missing."""
    return {"status": "ok", "customers_loaded": len(store)}

"""Application entrypoint. Run with: uvicorn app.main:app --reload

FastAPI was chosen for request validation (declared types reject bad input
before handlers run), the generated docs at /docs, and native async. See the
README for the fuller comparison against Flask and Django REST Framework.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.data_access.store import DatasetError, build_store
from app.errors import PROBLEM_BASE_URI, PROBLEM_CONTENT_TYPE, DomainError
from app.logging_config import RequestContextMiddleware, configure_logging
from app.routes import customers, model

logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the dataset before the first request is served."""
    configure_logging(settings.log_level, settings.json_logs)
    logger.info("Loading dataset", extra={"path": str(settings.csv_path)})

    try:
        app.state.store = build_store(settings.csv_path)
    except DatasetError:
        logger.exception("Dataset failed to load. The service cannot start.")
        raise

    logger.info("Ready", extra={"customers": len(app.state.store)})
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="savedesk API",
    version="1.0.0",
    summary="Churn risk scores and retention outreach tracking.",
    lifespan=lifespan,
)

# Request context runs outermost so every response gets a request ID.
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


def _problem(
    request: Request,
    *,
    status: int,
    title: str,
    detail: str,
    type_uri: str,
) -> JSONResponse:
    """Build an RFC 9457 problem+json response."""
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        media_type=PROBLEM_CONTENT_TYPE,
        content={
            "type": type_uri,
            "title": title,
            "status": status,
            "detail": detail,
            "instance": request.url.path,
            "request_id": request_id,
        },
        # Set here as well as in the middleware: an unhandled error unwinds past
        # the middleware before it can add the header, and a 500 is exactly when
        # the caller needs the ID to quote.
        headers={"X-Request-ID": request_id} if request_id else None,
    )


@app.exception_handler(DomainError)
async def handle_domain_error(request: Request, exc: DomainError) -> JSONResponse:
    return _problem(
        request,
        status=exc.status,
        title=exc.title,
        detail=exc.detail,
        type_uri=exc.type_uri,
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Bad input: out-of-range page size, unknown status value, malformed body.

    Returned as 400 rather than FastAPI's default 422, which is what this API
    documents and the more widely understood code for bad input.
    """
    problems = [
        f"{'.'.join(str(p) for p in err['loc'][1:]) or 'body'}: {err['msg']}"
        for err in exc.errors()
    ]
    return _problem(
        request,
        status=400,
        title="Invalid request",
        detail="; ".join(problems) or "The request could not be validated.",
        type_uri=f"{PROBLEM_BASE_URI}/invalid-request",
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Anything unhandled is a bug: log the traceback, return the request ID."""
    logger.exception(
        "Unhandled error",
        extra={"method": request.method, "path": request.url.path},
    )
    return _problem(
        request,
        status=500,
        title="Internal server error",
        detail=(
            "The request could not be completed. Quote the request_id when "
            "reporting this."
        ),
        type_uri=f"{PROBLEM_BASE_URI}/internal-error",
    )


app.include_router(customers.router, prefix=API_PREFIX)
app.include_router(model.router, prefix=API_PREFIX)

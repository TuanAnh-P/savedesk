"""Application errors, mapped to RFC 9457 problem+json responses by main.py."""

from __future__ import annotations

PROBLEM_BASE_URI = "https://savedesk.local/problems"
PROBLEM_CONTENT_TYPE = "application/problem+json"


class DomainError(Exception):
    """Base for expected failures. Anything else becomes a 500."""

    status: int = 500
    title: str = "Internal server error"
    code: str = "internal-error"

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)

    @property
    def type_uri(self) -> str:
        return f"{PROBLEM_BASE_URI}/{self.code}"


class CustomerNotFoundError(DomainError):
    status = 404
    title = "Customer not found"
    code = "customer-not-found"

    def __init__(self, customer_id: str) -> None:
        super().__init__(f"No customer exists with ID {customer_id!r}.")


class InvalidTransitionProblem(DomainError):
    # 409, not 400: the request is well formed but conflicts with current state,
    # so the same request could succeed later.
    status = 409
    title = "Invalid outreach transition"
    code = "invalid-transition"


class InvalidQueryError(DomainError):
    status = 400
    title = "Invalid query parameter"
    code = "invalid-query"


class DatasetUnavailableError(DomainError):
    status = 503
    title = "Dataset unavailable"
    code = "dataset-unavailable"

"""Outreach workflow state machine.

Transitions are data, not if-statements, so the API can tell a client what is
legal without duplicating the rule. See the README for why each move exists.
"""

from __future__ import annotations

from app.models.domain import OutreachStatus

# NOT_CONTACTED -> RESOLVED is absent on purpose: it would close a churn risk
# nobody ever called, so the dashboard would report work that never happened.
# Nothing returns to NOT_CONTACTED; an attempt cannot be un-attempted.
ALLOWED_TRANSITIONS: dict[OutreachStatus, frozenset[OutreachStatus]] = {
    OutreachStatus.NOT_CONTACTED: frozenset({OutreachStatus.IN_PROGRESS}),
    OutreachStatus.IN_PROGRESS: frozenset(
        {OutreachStatus.RESOLVED, OutreachStatus.UNREACHABLE}
    ),
    OutreachStatus.RESOLVED: frozenset({OutreachStatus.IN_PROGRESS}),
    OutreachStatus.UNREACHABLE: frozenset({OutreachStatus.IN_PROGRESS}),
}

TRANSITION_LABELS: dict[tuple[OutreachStatus, OutreachStatus], str] = {
    (OutreachStatus.NOT_CONTACTED, OutreachStatus.IN_PROGRESS): "Start outreach",
    (OutreachStatus.IN_PROGRESS, OutreachStatus.RESOLVED): "Mark resolved",
    (OutreachStatus.IN_PROGRESS, OutreachStatus.UNREACHABLE): "Mark unreachable",
    (OutreachStatus.RESOLVED, OutreachStatus.IN_PROGRESS): "Reopen",
    (OutreachStatus.UNREACHABLE, OutreachStatus.IN_PROGRESS): "Try again",
}


class InvalidTransitionError(Exception):
    """Raised when a status change is not permitted from the current state."""

    def __init__(self, current: OutreachStatus, requested: OutreachStatus) -> None:
        self.current = current
        self.requested = requested
        self.allowed = allowed_next(current)
        allowed_text = ", ".join(sorted(s.value for s in self.allowed)) or "none"
        super().__init__(
            f"Cannot move a customer from {current.value} to {requested.value}. "
            f"Allowed from {current.value}: {allowed_text}."
        )


def allowed_next(current: OutreachStatus) -> frozenset[OutreachStatus]:
    return ALLOWED_TRANSITIONS.get(current, frozenset())


def is_valid_transition(current: OutreachStatus, requested: OutreachStatus) -> bool:
    return requested in allowed_next(current)


def validate_transition(current: OutreachStatus, requested: OutreachStatus) -> None:
    """Raise InvalidTransitionError unless the move is permitted.

    A no-op move is rejected too: it is almost always a double-click, and
    accepting it would add a meaningless entry to the history.
    """
    if not is_valid_transition(current, requested):
        raise InvalidTransitionError(current, requested)


def describe_workflow() -> dict:
    """The state machine as data, for the API and the UI to render."""
    return {
        "initial_state": OutreachStatus.NOT_CONTACTED.value,
        "states": [s.value for s in OutreachStatus],
        "transitions": [
            {
                "from": state.value,
                "to": target.value,
                "label": TRANSITION_LABELS.get((state, target), target.value),
            }
            for state, targets in ALLOWED_TRANSITIONS.items()
            for target in sorted(targets, key=lambda s: s.value)
        ],
    }

"""Tests for the outreach state machine.

Every (from, to) pair is checked. Sixteen combinations is small enough to cover
exhaustively, which leaves no room for an untested transition to become legal.
"""

from __future__ import annotations

import itertools

import pytest

from app.models.domain import OutreachStatus
from app.services.outreach import (
    ALLOWED_TRANSITIONS,
    InvalidTransitionError,
    allowed_next,
    describe_workflow,
    is_valid_transition,
    validate_transition,
)

# Written out by hand: deriving this from the code under test would make the
# test pass no matter what that code said.
LEGAL_TRANSITIONS = {
    (OutreachStatus.NOT_CONTACTED, OutreachStatus.IN_PROGRESS),
    (OutreachStatus.IN_PROGRESS, OutreachStatus.RESOLVED),
    (OutreachStatus.IN_PROGRESS, OutreachStatus.UNREACHABLE),
    (OutreachStatus.RESOLVED, OutreachStatus.IN_PROGRESS),
    (OutreachStatus.UNREACHABLE, OutreachStatus.IN_PROGRESS),
}

ALL_PAIRS = list(itertools.product(OutreachStatus, OutreachStatus))


class TestTransitionTable:
    @pytest.mark.parametrize(("current", "requested"), ALL_PAIRS)
    def test_every_pair_matches_the_truth_table(
        self, current: OutreachStatus, requested: OutreachStatus
    ) -> None:
        expected = (current, requested) in LEGAL_TRANSITIONS
        assert is_valid_transition(current, requested) is expected

    @pytest.mark.parametrize(("current", "requested"), ALL_PAIRS)
    def test_validate_raises_exactly_on_illegal_pairs(
        self, current: OutreachStatus, requested: OutreachStatus
    ) -> None:
        if (current, requested) in LEGAL_TRANSITIONS:
            validate_transition(current, requested)
        else:
            with pytest.raises(InvalidTransitionError):
                validate_transition(current, requested)

    def test_all_states_have_a_rule(self) -> None:
        assert set(ALLOWED_TRANSITIONS) == set(OutreachStatus)


class TestBusinessRules:
    def test_cannot_resolve_without_contacting(self) -> None:
        """The rule the state machine exists for: closing a churn risk nobody
        called would report work that never happened."""
        with pytest.raises(InvalidTransitionError) as exc_info:
            validate_transition(OutreachStatus.NOT_CONTACTED, OutreachStatus.RESOLVED)
        # The message must name the legal alternative, not just refuse.
        assert "IN_PROGRESS" in str(exc_info.value)

    def test_cannot_mark_unreachable_without_attempting_contact(self) -> None:
        assert not is_valid_transition(
            OutreachStatus.NOT_CONTACTED, OutreachStatus.UNREACHABLE
        )

    def test_nothing_returns_to_not_contacted(self) -> None:
        for state in OutreachStatus:
            assert OutreachStatus.NOT_CONTACTED not in allowed_next(state)

    def test_terminal_states_can_be_reopened(self) -> None:
        """Retention work recurs, so neither outcome is a dead end."""
        assert is_valid_transition(OutreachStatus.RESOLVED, OutreachStatus.IN_PROGRESS)
        assert is_valid_transition(OutreachStatus.UNREACHABLE, OutreachStatus.IN_PROGRESS)

    @pytest.mark.parametrize("state", list(OutreachStatus))
    def test_no_op_transitions_are_rejected(self, state: OutreachStatus) -> None:
        assert not is_valid_transition(state, state)


class TestWorkflowDescription:
    def test_describes_every_legal_transition(self) -> None:
        pairs = {(t["from"], t["to"]) for t in describe_workflow()["transitions"]}
        assert pairs == {(c.value, r.value) for c, r in LEGAL_TRANSITIONS}

    def test_every_transition_has_an_agent_facing_label(self) -> None:
        for transition in describe_workflow()["transitions"]:
            assert transition["label"] != transition["to"]

"""Tests for the HTTP layer: the contract the frontend depends on."""

from __future__ import annotations

from fastapi.testclient import TestClient

API = "/api/v1"


class TestListEndpoint:
    def test_returns_a_page_envelope(self, client: TestClient) -> None:
        body = client.get(f"{API}/customers").json()
        assert set(body) == {"items", "page", "page_size", "total", "total_pages"}
        assert body["total"] == 3

    def test_defaults_to_highest_risk_first(self, client: TestClient) -> None:
        """The first page is the agent's call list, so ordering is a feature."""
        scores = [i["risk_score"] for i in client.get(f"{API}/customers").json()["items"]]
        assert scores == sorted(scores, reverse=True)

    def test_paginates_without_returning_everything(self, client: TestClient) -> None:
        page1 = client.get(f"{API}/customers?page=1&page_size=2").json()
        page2 = client.get(f"{API}/customers?page=2&page_size=2").json()

        assert len(page1["items"]) == 2
        assert len(page2["items"]) == 1
        assert page1["total"] == page2["total"] == 3
        assert page1["total_pages"] == 2

        ids1 = {i["customer_id"] for i in page1["items"]}
        ids2 = {i["customer_id"] for i in page2["items"]}
        assert ids1.isdisjoint(ids2)

    def test_page_beyond_the_end_returns_empty_not_an_error(
        self, client: TestClient
    ) -> None:
        body = client.get(f"{API}/customers?page=99").json()
        assert body["items"] == []
        assert body["total"] == 3

    def test_list_items_stay_lean(self, client: TestClient) -> None:
        """The projection is a contract: it must not grow into the full record."""
        item = client.get(f"{API}/customers").json()["items"][0]
        assert set(item) == {
            "customer_id",
            "tenure",
            "contract",
            "monthly_charges",
            "risk_score",
            "risk_tier",
            "outreach_status",
        }

    def test_filters_by_risk_tier(self, client: TestClient) -> None:
        body = client.get(f"{API}/customers?risk_tier=CRITICAL").json()
        assert body["total"] >= 1
        assert all(i["risk_tier"] == "CRITICAL" for i in body["items"])

    def test_filters_by_contract(self, client: TestClient) -> None:
        body = client.get(f"{API}/customers?contract=Month-to-month").json()
        assert all(i["contract"] == "Month-to-month" for i in body["items"])

    def test_filters_by_score_range(self, client: TestClient) -> None:
        body = client.get(f"{API}/customers?min_score=50&max_score=100").json()
        assert all(50 <= i["risk_score"] <= 100 for i in body["items"])

    def test_search_matches_customer_id_case_insensitively(
        self, client: TestClient
    ) -> None:
        body = client.get(f"{API}/customers?search=0002-risk").json()
        assert body["total"] == 1
        assert body["items"][0]["customer_id"] == "0002-RISK"

    def test_filters_combine_with_and(self, client: TestClient) -> None:
        body = client.get(
            f"{API}/customers?risk_tier=CRITICAL&outreach_status=NOT_CONTACTED"
        ).json()
        assert all(
            i["risk_tier"] == "CRITICAL" and i["outreach_status"] == "NOT_CONTACTED"
            for i in body["items"]
        )

    def test_sorts_by_other_fields(self, client: TestClient) -> None:
        items = client.get(f"{API}/customers?sort_by=tenure&order=asc").json()["items"]
        tenures = [i["tenure"] for i in items]
        assert tenures == sorted(tenures)


class TestListValidation:
    def test_rejects_an_oversized_page_size(self, client: TestClient) -> None:
        """The cap is what stops a client pulling the whole dataset at once."""
        response = client.get(f"{API}/customers?page_size=100000")
        assert response.status_code == 400
        assert response.headers["content-type"].startswith("application/problem+json")
        assert "page_size" in response.json()["detail"]

    def test_rejects_page_zero(self, client: TestClient) -> None:
        assert client.get(f"{API}/customers?page=0").status_code == 400

    def test_rejects_an_unknown_risk_tier(self, client: TestClient) -> None:
        assert client.get(f"{API}/customers?risk_tier=SEVERE").status_code == 400


class TestDetailEndpoint:
    def test_returns_profile_score_and_breakdown(self, client: TestClient) -> None:
        body = client.get(f"{API}/customers/0002-RISK").json()
        assert body["profile"]["customer_id"] == "0002-RISK"
        assert body["risk_score"] == 100
        assert body["risk_tier"] == "CRITICAL"

    def test_breakdown_carries_the_values_and_reasoning(self, client: TestClient) -> None:
        """The UI renders "why" from this, so it needs both without knowing the
        scoring rules itself."""
        for factor in client.get(f"{API}/customers/0002-RISK").json()["factors"]:
            assert set(factor) == {
                "key",
                "label",
                "observed",
                "points",
                "max_points",
                "rationale",
            }
            assert factor["rationale"]

    def test_never_exposes_the_churn_label(self, client: TestClient) -> None:
        """The historical outcome is validation data, not something to show."""
        profile = client.get(f"{API}/customers/0002-RISK").json()["profile"]
        assert "churned" not in profile

    def test_includes_allowed_next_states(self, client: TestClient) -> None:
        outreach = client.get(f"{API}/customers/0002-RISK").json()["outreach"]
        assert outreach["status"] == "NOT_CONTACTED"
        assert outreach["allowed_next"] == ["IN_PROGRESS"]

    def test_unknown_customer_returns_404_problem(self, client: TestClient) -> None:
        response = client.get(f"{API}/customers/NOPE-0000")
        assert response.status_code == 404
        body = response.json()
        assert body["title"] == "Customer not found"
        assert "NOPE-0000" in body["detail"]
        assert body["instance"] == f"{API}/customers/NOPE-0000"


class TestOutreachEndpoint:
    def test_valid_transition_succeeds_and_records_history(
        self, client: TestClient
    ) -> None:
        response = client.patch(
            f"{API}/customers/0001-LOWRK/outreach",
            json={"status": "IN_PROGRESS", "note": "Left a voicemail"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "IN_PROGRESS"
        assert body["updated_at"] is not None
        assert body["history"][0]["from_status"] == "NOT_CONTACTED"
        assert body["history"][0]["note"] == "Left a voicemail"
        assert sorted(body["allowed_next"]) == ["RESOLVED", "UNREACHABLE"]

    def test_illegal_transition_returns_409(self, client: TestClient) -> None:
        response = client.patch(
            f"{API}/customers/0001-LOWRK/outreach", json={"status": "RESOLVED"}
        )
        assert response.status_code == 409
        body = response.json()
        assert body["title"] == "Invalid outreach transition"
        # The message must say what the caller can do instead.
        assert "IN_PROGRESS" in body["detail"]

    def test_state_persists_across_requests(self, client: TestClient) -> None:
        client.patch(
            f"{API}/customers/0001-LOWRK/outreach", json={"status": "IN_PROGRESS"}
        )
        detail = client.get(f"{API}/customers/0001-LOWRK").json()
        assert detail["outreach"]["status"] == "IN_PROGRESS"

        listed = client.get(f"{API}/customers?search=0001-LOWRK").json()
        assert listed["items"][0]["outreach_status"] == "IN_PROGRESS"

    def test_full_lifecycle_including_retry(self, client: TestClient) -> None:
        path = f"{API}/customers/0003-MIDRK/outreach"
        for target in ("IN_PROGRESS", "UNREACHABLE", "IN_PROGRESS", "RESOLVED"):
            assert client.patch(path, json={"status": target}).status_code == 200

        history = client.get(f"{API}/customers/0003-MIDRK").json()["outreach"]["history"]
        assert len(history) == 4

    def test_unknown_customer_returns_404(self, client: TestClient) -> None:
        response = client.patch(
            f"{API}/customers/NOPE-0000/outreach", json={"status": "IN_PROGRESS"}
        )
        assert response.status_code == 404

    def test_unknown_status_is_rejected(self, client: TestClient) -> None:
        response = client.patch(
            f"{API}/customers/0001-LOWRK/outreach", json={"status": "BANANA"}
        )
        assert response.status_code == 400

    def test_unexpected_fields_are_rejected(self, client: TestClient) -> None:
        response = client.patch(
            f"{API}/customers/0001-LOWRK/outreach",
            json={"status": "IN_PROGRESS", "risk_score": 0},
        )
        assert response.status_code == 400


class TestModelInfoEndpoint:
    def test_exposes_rules_workflow_and_validation(self, client: TestClient) -> None:
        body = client.get(f"{API}/model/info").json()
        assert set(body) == {"scoring", "workflow", "validation"}
        assert len(body["scoring"]["factors"]) == 10
        assert body["workflow"]["initial_state"] == "NOT_CONTACTED"

    def test_publishes_the_thresholds_the_api_applies(self, client: TestClient) -> None:
        """The UI reads thresholds from here instead of hardcoding them."""
        scoring = client.get(f"{API}/model/info").json()["scoring"]
        tiers = {t["tier"]: t["min_score"] for t in scoring["tiers"]}
        assert tiers == {"CRITICAL": 70, "HIGH": 50, "MEDIUM": 30, "LOW": 0}

    def test_reports_measured_accuracy_per_tier(self, client: TestClient) -> None:
        validation = client.get(f"{API}/model/info").json()["validation"]
        assert validation["dataset_size"] == 3
        assert {t["tier"] for t in validation["tiers"]} == {
            "CRITICAL",
            "HIGH",
            "MEDIUM",
            "LOW",
        }


class TestOperationalConcerns:
    def test_health_reports_dataset_size(self, client: TestClient) -> None:
        assert client.get(f"{API}/health").json() == {
            "status": "ok",
            "customers_loaded": 3,
        }

    def test_inbound_request_id_is_preserved(self, client: TestClient) -> None:
        """The ID links a user's report to the server-side log line."""
        response = client.get(f"{API}/customers", headers={"X-Request-ID": "trace-me"})
        assert response.headers["X-Request-ID"] == "trace-me"

    def test_errors_include_the_request_id(self, client: TestClient) -> None:
        response = client.get(f"{API}/customers/NOPE-0000")
        assert response.json()["request_id"] == response.headers["X-Request-ID"]

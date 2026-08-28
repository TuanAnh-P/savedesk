# Full-Stack Technical Assessment: Churn Risk & Retention Console

## Business Context

Our data science team has built a churn model that scores customers by likelihood
to cancel their subscription. A model sitting in a notebook is useless to the
business - someone has to operationalize it: surface the scores to the people
who act on them, and let those people record what they did about it.

That "someone" is you. You're not building a data science project. You're
building the **management console that sits on top of the model** - the tool a
retention agent or team lead opens every morning to answer three questions:

1. Who is at risk of churning right now?
2. Why does the model think that?
3. What have we already done about it, and what do we need to do next?

Treat the heuristic scoring logic you write as a stand-in for "the model" -
in production this might be a versioned ML service behind an API, but the
console's job is the same regardless of what produces the score: **surface it,
explain it, and let a human act on it.**

## The Dataset

We've bundled the [Telco Customer Churn dataset](https://www.kaggle.com/datasets/blastchar/telco-customer-churn)
(IBM/WA sample) at `data/WA_Fn-UseC_-Telco-Customer-Churn.csv`. No Kaggle account or
download needed.

Columns include: `customerID`, `gender`, `SeniorCitizen`, `Partner`,
`Dependents`, `tenure`, `PhoneService`, `MultipleLines`, `InternetService`,
`OnlineSecurity`, `OnlineBackup`, `DeviceProtection`, `TechSupport`,
`StreamingTV`, `StreamingMovies`, `Contract`, `PaperlessBilling`,
`PaymentMethod`, `MonthlyCharges`, `TotalCharges`, `Churn`.

Load this into memory at application startup. **You do not need a database
for this exercise** (see "Explicitly Out of Scope" below).

## What You're Building

A two-part application:

- **Backend** - must be written in **Python** (framework is your choice -
  FastAPI, Flask, Django REST, etc. - justify the choice in your README).
- **Frontend** - any modern JS/TS framework of your choice (React, Vue,
  Svelte, plain HTML/JS, etc.). It must be a genuine separate client that
  talks to your API over HTTP - not a Python-templated UI (e.g. no
  Streamlit/Jinja dashboards). We want to see a real UI/API boundary.

### Backend requirements

1. **`GET /customers`** - paginated, filterable list of customers with their
   computed risk score/tier (e.g. filter by risk tier, contract type,
   outreach status). Do not return the entire dataset in one payload.
2. **`GET /customers/{id}`** - full customer record, computed risk score,
   and a breakdown of *why* (which factors drove the score).
3. **`PATCH /customers/{id}/outreach`** - update a customer's outreach
   status. Model a small state machine, e.g.:
   `NOT_CONTACTED -> IN_PROGRESS -> RESOLVED` (feel free to adjust states,
   just make the transitions explicit and validated - you shouldn't be able
   to jump straight from `NOT_CONTACTED` to `RESOLVED` if that doesn't make
   sense in your model, or you should explain why it does).
4. **`GET /model/info`** (or similar) - expose the current scoring rules /
   weights your heuristic uses. This is what lets the frontend explain "why"
   a customer is high-risk, and it's the seed of "managing the model" rather
   than just consuming its output.
5. **Risk scoring logic** - a rule-based/heuristic function you design
   (e.g. weighted by tenure, contract type, monthly charges, support
   tickets-equivalent fields, etc.). This is not a real ML model - document
   your rules and your reasoning.
6. **Error handling** - try/except around I/O and input parsing, meaningful
   HTTP status codes (400 for bad input, 404 for missing customer, 500 for
   unexpected failures), structured logging of requests/errors.
7. **Unit tests** - at minimum, cover the scoring logic and the outreach
   state-transition validation.
8. **Parallelism** - I/O bound operations should ideally be handled in an
   efficient manner, whether that is done by multi-threading, multi-processing,
   or asynchronous functionality

### Frontend requirements

1. **List/dashboard view** - customers with a visible, scannable risk
   indicator (color, sort, badge - your call), pagination, and
   filter/search. A retention agent should be able to find "who do I need
   to call today" in seconds.
2. **Detail view** - full profile, risk score, and *why* (the factor
   breakdown from `/model/info` + the customer's own data).
3. **Outreach action UI** - update a customer's outreach status from the
   UI, with visible loading and error states. This is the "managing the
   logic in practice" part - treat it like a real operational tool, not a
   form bolted onto a report.
4. **Resilience in the UI** - if the API is slow, down, or errors, the
   agent should see a clear message, not a blank screen or console error.

### What "good" looks like

Imagine handing this to a non-technical retention team lead. They should be
able to open it, immediately see who's at risk and why, click into a
customer, mark them as contacted, and trust that the state persists (within
the life of the running server - see scope note below).

## Technical Requirements

- Backend: Python, any framework, in-memory data store (loaded from the
  bundled CSV at startup - no external DB required for this exercise).
- Frontend: any modern JS/TS framework.
- Tests: at least the scoring logic and one API endpoint.
- **Every non-trivial decision must be explained in your README** -
  framework choice, data modeling, scoring design, pagination approach,
  error-handling approach, testing approach, and anything you deliberately
  cut due to time.

## Explicitly Out of Scope (for now)

These are intentionally **not** required here - you'll discuss how you'd
approach them in a separate system design conversation:

- A real trained ML model (your heuristic is a deliberate stand-in).
- A persistent database (in-memory is fine and expected).
- A caching layer (Redis or otherwise).
- Authentication/authorization or multi-tenancy.
- Rate limiting, load balancing, or horizontal scaling.
- Deployment (optional bonus only - not scored if skipped).

If you have spare time, a short note in your README on how you'd evolve
any of the above is welcome, but not required or scored beyond what's in
the rubric below.

## Time Expectation

We are not grading completeness for its own sake - a smaller, 
well-reasoned, well-tested submission beats a larger, unexplained
one. If you run out of time, tell us what you'd do next in a
"With more time" section of your README rather than rushing.

## Evaluation Rubric

| Area | Weight | What we look for |
|---|---|---|
| Code Quality & Modularity | 30% | Clean separation of UI / API routes / data access. Consistent naming, reusable components, DRY. No spaghetti code or giant single-file components. |
| System Design & Scalability | 25% | Sensible API structure, real pagination/filtering (not "return everything and filter client-side"), and a README that correctly identifies scaling bottlenecks. |
| Operational Excellence | 20% | Error handling, meaningful HTTP status codes, try/except, basic unit tests, clear logging. |
| Business Alignment & UI/UX | 15% | Can a retention agent actually use this? Are high-risk customers obvious? Is the flow (list -> detail -> act) logical? |
| Technical Communication | 10% | Can we clone and run this in 5 minutes? Is the README crisp and does it explain trade-offs without unnecessary jargon? |

## Repository Structure

This repo comes with a minimal starting layout - fill it in as you build, and alter it as you see fit:

```
deai-technical-assessment/
├── data/                 # bundled CSV dataset (do not move)
├── backend/              # Python API (your framework choice)
│   ├── app/
│   │   ├── main.py       # app entrypoint
│   │   ├── routes/       # API route handlers
│   │   ├── models/       # data schemas / types
│   │   ├── services/     # scoring logic, business rules
│   │   └── data_access/  # CSV loading, in-memory store
│   ├── tests/            # unit tests
│   └── requirements.txt
└── frontend/             # JS/TS client (your framework choice)
```

The `backend/` subfolders are a suggestion, not a requirement - reorganize
them if your framework or design calls for something different, as long as
the separation of concerns (routes vs. business logic vs. data access) is
still clear.

## Submission

Submit a git repo (or zip) containing:

- **Source code** for both `backend/` and `frontend/`, following the
  structure above (or your justified variation of it).
- **A root-level `README.md`** (or updated version of this one) that
  includes:
  - Setup/run instructions for both backend and frontend, verified to
    work from a clean clone (target: running in under 5 minutes).
  - Your framework choice and why.
  - Your data modeling and risk-scoring design/reasoning.
  - Your pagination and filtering approach.
  - Your error-handling and logging approach.
  - Your testing approach (what's covered, what isn't, and why).
  - Any trade-offs or shortcuts taken due to time.
  - A "With more time" section noting what you'd do next.
- **Tests** for the backend (at minimum: scoring logic + the outreach
  state-transition validation, per the requirements above).
- **No `node_modules/`, virtual envs, or build artifacts** - include a
  `.gitignore` so the repo stays clean.

Do not include committed secrets, API keys, or unnecessary binary files.
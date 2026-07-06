# Changelog

## Batch 7 - A2A Demonstration

- Added independent `BuyerAgent`, `SellerAgent`, and `ObserverAgent` demo clients.
- Added HTTP Parley API client used by the demo agents.
- Added `/api/a2a/demo` endpoint to orchestrate the agents through public API calls.
- Updated the frontend to consume the A2A demo endpoint instead of starting negotiation directly.
- Added an A2A integration test proving buyer and seller agents negotiate entirely through the public API.
- Added architecture diagram and A2A protocol documentation.

## Batch 6 - Negotiation Policies & Market Intelligence

- Extended seller policies with recurring client discount, workload limits, and preferred payment schedule.
- Added deterministic policy explainability to agreement payloads.
- Added demo-data market intelligence for average, range, recommended offer, and savings.
- Added market intelligence to API responses and UI.
- Updated UI flow to show Seller Policy -> Negotiation -> Market Comparison -> Locked Terms.
- Added deterministic market tests and API assertions.

## Batch 5 - CROO Commerce Lifecycle

- Added immutable `LockedTerms` generation from successful negotiations.
- Added `DeliveryProof` placeholder support.
- Added generic settlement adapter boundary.
- Added `MockSettlementAdapter` and `CROOSettlementAdapter` stub.
- Extended API responses with commerce order lifecycle state.
- Updated the UI to show the full commerce lifecycle, not just agreement.
- Added HTTP tests for settled and failed commerce order paths.

## Batch 4 - Protocol API

- Added versioned REST API endpoints:
  - `POST /api/negotiate/start`
  - `POST /api/negotiate/message`
  - `GET /api/negotiate/:id`
  - `GET /api/negotiate/:id/history`
- Added `protocolVersion` to every API response.
- Added in-memory negotiation storage for demo sessions.
- Switched the frontend to start negotiations through the REST API.
- Added HTTP integration tests for start, read, history, and invalid transition behavior.
- Added API documentation with request/response examples.

## Batch 3 - AI Negotiation Layer

- Added provider-agnostic `AIProvider`.
- Added Anthropic provider and local fallback provider.
- Added structured `NegotiationExplanation` validation.
- Displayed deterministic protocol decision separately from AI reasoning.

## Batch 2 - Multi-Round Negotiation Engine

- Added negotiation sessions, protocol messages, max-round enforcement, and state-machine transitions.
- Added tests for agreement, no-deal, max rounds, and invalid transitions.

## Batch 1 - Vertical MVP

- Scaffolded the Next.js app.
- Added `parley-core` deterministic negotiation flow.
- Added visible protocol JSON demo.

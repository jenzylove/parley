# Changelog

## Batch 10 - Message Signing, Live On-Chain Proof, Negotiation Theater UI

- Proved the full CAP order lifecycle end-to-end on Base mainnet for real: negotiate → lock → pay → deliver → clear, with three independently-verifiable transaction hashes. Found and fixed a `payOrder`→`deliverOrder` race (server needs to wait for the on-chain payment to confirm before delivering, same class of bug as the earlier `createOrder` race) by testing the live flow, not just unit tests.
- Added Ed25519 message signing (`src/core/parley-core/negotiation/signing.ts`, zero new dependencies — Node's built-in `crypto`). `SellerPolicy.publicKey` and `ServiceRequest.buyerPublicKey` declare each side's identity; every `Offer`/`CounterOffer`/`Accept`/`NoDeal` a real agent sends is signed and verified server-side before being applied — an unsigned or wrong-key message never reaches the state machine.
- Added `AgreementPayload.platformAttestation`: since `Agreement` is synthesized by Parley's server (not either counterparty), it's attested with Parley's own platform keypair rather than forging a signature on the seller's behalf.
- Restructured `POST /api/negotiate/open` so the buyer's opening offer is built and signed by the buyer's own process, not constructed by the server — a message Parley authored on the buyer's behalf couldn't actually be signed by the buyer.
- Updated both standalone agent processes (`npm run agent:buyer`/`agent:seller`) to generate their own keypair and sign every message they send, and added the real fake-signature-rejection integration test.
- Made the AI explanation layer resilient: a provider failure (e.g. a stale/retired model id) now falls back to the deterministic local explainer instead of taking down the entire negotiation response — found by exercising the real UI, not the test suite.
- Built the negotiation-theater homepage: a scenario picker (balanced / bundle+recurring / rush / no-deal) that animates a real negotiation's message history and commerce lifecycle step-by-step, plus a static "verified on-chain settlement" panel with real Basescan-linked transaction hashes. Verified in an actual headless browser (screenshots + zero console errors), not just typechecked.

## Batch 9 - Seller Registry & Real A2A

- Moved `recurringClient` onto the wire (`OfferPayload`) — a seller's counter-offer strategy no longer needs out-of-band access to the buyer's private `ServiceRequest`.
- Extracted `decideSellerMove`/`decideBuyerMove` into `parley-core/negotiation/strategy.ts` — pure functions taking only the deciding party's own private data plus the counterparty's last wire message.
- Added a seller policy registry (`POST /api/sellers/register`, `GET /api/sellers`, `GET /api/sellers/:id/pending`) — a buyer no longer submits the seller's policy (including its reservation price) to start a negotiation; it references a `sellerAgentId` instead.
- Added `POST /api/negotiate/open` for turn-by-turn negotiation, alongside the existing one-shot `POST /api/negotiate/start`. A valid `Accept` submitted via `/api/negotiate/message` now triggers server-synthesized `Agreement` plus commerce/settlement, matching the one-shot path.
- Added two standalone agent processes, `npm run agent:buyer` / `npm run agent:seller` — genuinely separate OS processes that only talk to Parley over HTTP, using `tsx` to run TypeScript directly with zero build step.
- Updated `BuyerAgent`/`SellerAgent`/A2A demo runner to register/reference sellers through the registry instead of an in-process policy handoff.
- Fixed the demo UI and `A2ADemoResult` to stop exposing the seller's `minimumPrice`/`preferredPrice` — both were previously visible in the browser and the `/api/a2a/demo` response.
- Added `docs/SPEC.md`, the external-agent protocol spec — the concrete deliverable behind "extract the negotiation schema into an SDK so other CAP agents can adopt it."
- Fixed a cross-route in-memory state bug: Next.js's dev bundler (Turbopack) compiles each route handler into its own isolated module graph, so a plain module-scope `Map` was a different instance per route (writes in one route invisible to another) — found by testing the real HTTP flow end-to-end, not by the vitest suite. Fixed via `getGlobalSingleton()` (`src/api/global-singleton.ts`), anchoring shared state to `globalThis`.
- Fixed three real CAP integration bugs found by running the full negotiate → settle flow against the live network: a provider needs an active WebSocket connection before CAP will accept orders addressed to it (`PROVIDER_NOT_ACCEPTING_ORDERS`); the fund-token address comparison must be case-insensitive (CAP echoes it lowercased, Parley's constant is EIP-55 checksummed); and `payOrder` must wait for the async on-chain `createOrder` tx to confirm (`INVALID_STATUS`) rather than firing immediately after accept. See `docs/CAP_INTEGRATION.md`.

## Batch 8 - Real CAP Settlement

- Replaced the `CROOSettlementAdapter` stub with a real integration against `@croo-network/sdk`: `negotiateOrder` → `acceptNegotiationWithFundAddress` → `payOrder` → `deliverOrder` → `getDelivery`, bridging Parley's negotiated price onto CAP via fund-transfer negotiation.
- Added `createSettlementAdapter()` to select the real adapter when `CROO_*` env vars are set, falling back to `MockSettlementAdapter` otherwise.
- Added MIT license, README, `.env.example`, and `docs/CAP_INTEGRATION.md` for hackathon submission eligibility.

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

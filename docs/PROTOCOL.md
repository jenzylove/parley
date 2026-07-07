# Protocol

Protocol version: `parley-negotiation/0.1`

Parley owns negotiation. CROO owns the commerce lifecycle after negotiation succeeds.

For the full wire-level spec aimed at an external agent implementing this protocol independently (any language, no dependency on this repo), see **`docs/SPEC.md`**. This page is the conceptual overview.

## Negotiation Layer

Parley protocol messages:

- `Offer`
- `CounterOffer`
- `Accept`
- `Reject`
- `Agreement`
- `NoDeal`

The deterministic engine decides whether a message is valid and whether the negotiation should continue.

## Seller Policies

Each seller registers a machine-readable policy with Parley's registry (`POST /api/sellers/register`) — **not** with the buyer:

- `minimumPrice`
- `preferredPrice`
- `rushFee`
- `bundleDiscount`
- `recurringClientDiscount`
- `maximumWorkload`
- `currentWorkload`
- `preferredPaymentSchedule`
- `maxRounds`

A buyer starts a negotiation by referencing a `sellerAgentId`, never by submitting the policy itself. `GET /api/sellers` exposes only a price-free discovery view (service, currency, standard delivery days, max rounds). This is what makes an independent, un-trusted seller possible — earlier batches required the buyer to already hold the seller's full policy (including its reservation price) just to start a negotiation, which defeated the point of negotiating at all.

Negotiation operates against the registered policy deterministically. AI can explain the result, but it cannot modify pricing, approve agreements, or bypass constraints.

## Signing

Every seller policy and buyer request declares an Ed25519 public key (`publicKey` / `buyerPublicKey`); every `Offer`/`CounterOffer`/`Accept`/`NoDeal` a real agent sends must carry a `signature` verifying against it, checked server-side before the message is applied. Nobody — not the counterparty, not Parley — ever holds the private key. `Agreement` messages are the exception: Parley's server synthesizes them, so it attests them instead with its own platform keypair (`AgreementPayload.platformAttestation`) rather than forging a signature on the seller's behalf. See `docs/SPEC.md`'s "Signing & verification" section for the full scheme, and `src/core/parley-core/negotiation/signing.ts` for the implementation. CAP's own AA wallet keys play no part in this — CROO's backend never exposes them to SDK callers, so this is a Parley-native layer of identity sitting above CAP, not a reuse of it.

## Turn-By-Turn Negotiation (real counterparties)

`POST /api/negotiate/start` remains a one-shot reference resolution (useful for demos/tests): it runs both sides' strategies synchronously and returns a finished result.

For a real external counterparty — a standalone process, or another team's agent — `POST /api/negotiate/open` records only the buyer's opening offer and leaves the session live. Each side then plays its own moves via `POST /api/negotiate/message`, deciding using only its own private data plus the wire history (see `decideSellerMove`/`decideBuyerMove` in `src/core/parley-core/negotiation/strategy.ts`). When a valid `Accept` lands, the server — which is the only party holding the seller's registered policy — synthesizes the `Agreement` and drives commerce/settlement automatically.

`npm run agent:seller` and `npm run agent:buyer` are two such standalone processes, each a distinct OS process talking only to the HTTP API.

## Market Intelligence

The market engine uses demo data to calculate:

- market average
- market range
- recommended offer
- savings after negotiation

This is deterministic and does not use AI.

## Agreement Explainability

Successful agreements include `policyExplanation`:

- why the price was accepted
- which constraints mattered
- final policy floor
- buyer savings versus seller preferred price

## Locked Terms

When a negotiation succeeds, Parley creates `LockedTerms`.

`LockedTerms` are immutable and become the source of truth for downstream commerce. They are the handoff into settlement and delivery.

## Delivery Proof

`DeliveryProof` is a typed placeholder in this batch.

It exists so the lifecycle can model proof attachment before settlement without inventing a CROO-specific proof API.

## CROO Commerce Mapping

Parley maps onto the CROO commerce lifecycle as follows:

- `POSTED`: order created from the buyer request
- `NEGOTIATING`: Parley is actively producing negotiation messages
- `LOCKED`: locked terms have been generated
- `DELIVERING`: placeholder delivery proof attached
- `DELIVERED`: proof acknowledged
- `SETTLING`: settlement adapter invoked
- `SETTLED`: adapter completed successfully
- `FAILED`: negotiation or settlement failed

This batch does not invent CAP APIs. It only models the lifecycle the official CROO pages describe.

## Settlement Adapters

Settlement remains behind a generic adapter interface.

- `MockSettlementAdapter` completes the lifecycle locally, with no network calls. Used automatically when CAP credentials are absent (e.g. in tests, or a demo without dashboard setup).
- `CROOSettlementAdapter` drives the real CAP order lifecycle through `@croo-network/sdk`: `negotiateOrder` → `acceptNegotiationWithFundAddress` → `payOrder` → `deliverOrder` → `getDelivery`. Selected automatically by `createSettlementAdapter()` when all `CROO_*` env vars are set. See `docs/CAP_INTEGRATION.md` for how Parley's negotiated price is bridged onto a CAP order.

## Source Files

- `src/core/parley-core/commerce/*`
- `src/cap/*`
- `src/api/negotiate-service.ts`
- `src/agents/a2a/*`

## A2A Composability

Two layers of protocol clients exist:

- `BuyerAgent` / `SellerAgent` / `ObserverAgent` (`src/agents/a2a`): in-process demo clients used by `/api/a2a/demo` for the one-shot showcase. They call only the public HTTP API, never `parley-core` directly, but they run inside the same Node process as the server.
- `run-buyer-agent.ts` / `run-seller-agent.ts` (`npm run agent:buyer` / `npm run agent:seller`): genuinely separate OS processes. Neither imports the other's code or the server's internals — they poll and post exactly the endpoints in `docs/SPEC.md`. This is the real composability proof: either script could be swapped for a different team's agent, in a different language, with no code shared beyond the wire protocol.

# Protocol

Protocol version: `parley-negotiation/0.1`

Parley owns negotiation. CROO owns the commerce lifecycle after negotiation succeeds.

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

Each seller publishes a machine-readable policy:

- `minimumPrice`
- `preferredPrice`
- `rushFee`
- `bundleDiscount`
- `recurringClientDiscount`
- `maximumWorkload`
- `currentWorkload`
- `preferredPaymentSchedule`
- `maxRounds`

Negotiation operates against this policy deterministically. AI can explain the result, but it cannot modify pricing, approve agreements, or bypass constraints.

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

The demo includes three protocol clients:

- `BuyerAgent`: submits a service request and starts negotiation through the public API.
- `SellerAgent`: publishes a machine-readable policy consumed by the buyer through Parley.
- `ObserverAgent`: watches protocol history through the public API and summarizes message flow.

The agents do not call `parley-core` directly.

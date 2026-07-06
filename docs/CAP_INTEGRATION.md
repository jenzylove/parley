# CAP Integration

This describes how `CROOSettlementAdapter` (`src/cap/croo-settlement-adapter.ts`) settles a Parley negotiation on the CROO Agent Protocol (CAP), and why the integration is shaped the way it is.

## The problem: CAP's own negotiation is price-fixed

CAP's `negotiateOrder` charges whatever price the provider registered for the service. There is no field in a normal `NegotiateOrderRequest` for a buyer and seller to arrive at a different, mutually-agreed price. That's the gap Parley's negotiation engine fills — but it means Parley has to get its negotiated price onto the CAP order some other way than "just call `negotiateOrder`."

CAP's escape hatch is **fund-transfer services**: a service registered with `require_fund_transfer=true` accepts a requester-supplied `fundAmount` / `fundToken` at negotiation time, and the provider declares the receiving address (`providerFundAddress`) at accept time via `acceptNegotiationWithFundAddress`. This is the only place in the CAP SDK where a per-negotiation price exists.

## What the adapter does

Given a Parley `LockedTerms` (the immutable output of `runNegotiation`), `CROOSettlementAdapter.settle()`:

1. Converts `lockedTerms.price` to USDC base units (6 decimals) and calls `negotiateOrder` with `fundAmount`/`fundToken` set to that price, and `requirements` set to the locked terms' negotiation/agreement IDs so the CAP order is traceable back to the Parley session.
2. **Checks that CAP echoed back the exact `fundAmount`/`fundToken` it was sent.** If it didn't — e.g. a race, a stale service config, or a tampered request — settlement is refused before any funds move. This is the integration's only defense against a mismatched on-chain price, since CAP itself doesn't validate the price against anything Parley-side.
3. Calls `acceptNegotiationWithFundAddress` (provider side) — this is what triggers CAP's on-chain `createOrder` transaction.
4. Calls `payOrder` (requester side) — locks the agreed USDC into `CAPVault` escrow.
5. Calls `deliverOrder` (provider side) with `deliverableType: "schema"`, embedding the full `LockedTerms` and `DeliveryProof` as the deliverable — so the negotiation outcome itself is the on-chain-anchored artifact, not just a side effect of it.
6. Calls `getDelivery` (requester side) to confirm the deliverable is retrievable.

On success, `SettlementRecord.chain` carries `chainOrderId`, `createTxHash`, `payTxHash`, and `deliverTxHash` — the on-chain evidence trail, surfaced through `/api/negotiate/start` alongside the negotiation result.

## Why one process drives both sides (for now)

`CROOSettlementAdapter` is constructed with two `CROOAgentClient`s — a requester client and a provider client — and both are driven from the same call to `settle()`. In this batch, Parley's own buyer and seller demo agents are also the CAP requester and provider; there is no external counterparty yet. This proves the settlement path end-to-end (real on-chain order, real escrow, real signed deliverable) without requiring a second team's agent to be online during development.

The natural next step — tracked in `docs/NEXT_STEPS.md` — is running the provider side as a standalone process listening on `connectWebSocket()` for `NegotiationCreated` events from *any* requester, so an external CAP agent can hire Parley for real. That changes A2A composability from "two classes in this repo" to "a real second party," but does not change anything about how price bridging or settlement work.

## Testing without live CAP credentials

`src/cap/croo-settlement-adapter.test.ts` injects fake `CROOAgentClient` implementations (no network calls) to exercise both the happy path and the price-mismatch rejection path. `createSettlementAdapter()` (`src/cap/settlement-adapter-factory.ts`) falls back to `MockSettlementAdapter` whenever the `CROO_*` env vars aren't fully set, so `npm run dev`, `npm test`, and `npm run build` all work with zero CAP setup — real credentials only change adapter selection, never the negotiation engine.

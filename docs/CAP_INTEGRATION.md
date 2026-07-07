# CAP Integration

This describes how `CROOSettlementAdapter` (`src/cap/croo-settlement-adapter.ts`) settles a Parley negotiation on the CROO Agent Protocol (CAP), and why the integration is shaped the way it is.

## The problem: CAP's own negotiation is price-fixed

CAP's `negotiateOrder` charges whatever price the provider registered for the service. There is no field in a normal `NegotiateOrderRequest` for a buyer and seller to arrive at a different, mutually-agreed price. That's the gap Parley's negotiation engine fills — but it means Parley has to get its negotiated price onto the CAP order some other way than "just call `negotiateOrder`."

CAP's escape hatch is **fund-transfer services**: a service registered with `require_fund_transfer=true` accepts a requester-supplied `fundAmount` / `fundToken` at negotiation time, and the provider declares the receiving address (`providerFundAddress`) at accept time via `acceptNegotiationWithFundAddress`. This is the only place in the CAP SDK where a per-negotiation price exists.

## What the adapter does

Given a Parley `LockedTerms` (the immutable output of `runNegotiation`), `CROOSettlementAdapter.settle()`:

1. Ensures the provider agent has an active WebSocket connection (`connectWebSocket()`) before doing anything else — see "CAP requires a provider to be online" below.
2. Converts `lockedTerms.price` to USDC base units (6 decimals) and calls `negotiateOrder` with `fundAmount`/`fundToken` set to that price, and `requirements` set to the locked terms' negotiation/agreement IDs so the CAP order is traceable back to the Parley session.
3. **Checks that CAP echoed back the exact `fundAmount` and `fundToken` it was sent** (address comparison is case-insensitive — see below). If it didn't — e.g. a race, a stale service config, or a tampered request — settlement is refused before any funds move. This is the integration's only defense against a mismatched on-chain price, since CAP itself doesn't validate the price against anything Parley-side.
4. Calls `acceptNegotiationWithFundAddress` (provider side) — this triggers CAP's on-chain `createOrder` transaction.
5. Polls `getOrder` until status reaches `"created"` before paying — see "on-chain confirmation is asynchronous" below.
6. Calls `payOrder` (requester side) — locks the agreed USDC into `CAPVault` escrow.
7. Calls `deliverOrder` (provider side) with `deliverableType: "schema"`, embedding the full `LockedTerms` and `DeliveryProof` as the deliverable — so the negotiation outcome itself is the on-chain-anchored artifact, not just a side effect of it.
8. Calls `getDelivery` (requester side) to confirm the deliverable is retrievable.

On success, `SettlementRecord.chain` carries `chainOrderId`, `createTxHash`, `payTxHash`, and `deliverTxHash` — the on-chain evidence trail, surfaced through `/api/negotiate/start` alongside the negotiation result.

## Integration gotchas found by testing against the live network

None of these are documented explicitly by CROO; all were found by running the real flow end-to-end and reading the actual `APIError` responses (`npm run cap:smoke` is useful for isolating these one at a time).

- **CAP requires a provider to be online.** A provider that has never called `connectWebSocket()` gets `PROVIDER_NOT_ACCEPTING_ORDERS` on `acceptNegotiationWithFundAddress`, even with no dashboard toggle indicating this. `CROOSettlementAdapter.ensureProviderOnline()` opens (and caches) a WebSocket connection before the provider's first accept call.
- **Address comparison must be case-insensitive.** CAP echoes `fundToken` back lowercased; Parley's configured `usdcTokenAddress` is EIP-55 checksummed (mixed-case). Byte-for-byte they're the same address — comparing them with `!==` produces a false-positive "price mismatch" rejection. Fixed via `sameAddress()` in `src/cap/usdc.ts`.
- **On-chain order confirmation is asynchronous.** `acceptNegotiationWithFundAddress`'s `createOrder` transaction is submitted, not necessarily mined, by the time the call returns — calling `payOrder` immediately can hit `INVALID_STATUS: order can only be paid when status is created` if the order is still `"creating"`. `CROOSettlementAdapter.waitForOrderCreated()` polls `getOrder` (every 1.2s, up to 20 attempts) before paying.
- **`ERC20: transfer amount exceeds balance`** on `payOrder` means exactly what it says — the requester agent's AA wallet doesn't hold enough USDC. Not a bug; see "Enabling real CAP settlement" in the README for funding instructions (CAP has no testnet, so this is real USDC on Base mainnet, kept intentionally small).

## Why one process drives both sides (for now)

`CROOSettlementAdapter` is constructed with two `CROOAgentClient`s — a requester client and a provider client — and both are driven from the same call to `settle()`. In this batch, Parley's own buyer and seller demo agents are also the CAP requester and provider; there is no external counterparty yet. This proves the settlement path end-to-end (real on-chain order, real escrow, real signed deliverable) without requiring a second team's agent to be online during development.

The natural next step — tracked in `docs/NEXT_STEPS.md` — is running the provider side as a standalone process listening on `connectWebSocket()` for `NegotiationCreated` events from *any* requester, so an external CAP agent can hire Parley for real. That changes A2A composability from "two classes in this repo" to "a real second party," but does not change anything about how price bridging or settlement work.

## Testing without live CAP credentials

`src/cap/croo-settlement-adapter.test.ts` injects fake `CROOAgentClient` implementations (no network calls) to exercise both the happy path and the price-mismatch rejection path. `createSettlementAdapter()` (`src/cap/settlement-adapter-factory.ts`) falls back to `MockSettlementAdapter` whenever the `CROO_*` env vars aren't fully set, so `npm run dev`, `npm test`, and `npm run build` all work with zero CAP setup — real credentials only change adapter selection, never the negotiation engine.

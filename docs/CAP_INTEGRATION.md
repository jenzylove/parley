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

## Why `CROOSettlementAdapter` drives both sides

`CROOSettlementAdapter` is constructed with two `CROOAgentClient`s — a requester client and a provider client — and both are driven from the same call to `settle()`. This is Parley's own buyer and seller demo agents acting as the CAP requester and provider, proving the settlement path end-to-end (real on-chain order, real escrow, real signed deliverable) without requiring anyone else to be online.

That's deliberately *not* the only way Parley shows up on CAP, though — see below.

## The inbound provider listener: answering a real external hire

`CROOSettlementAdapter` only covers Parley's *outbound* leg (Parley hiring itself, essentially). Separately, Parley is listed on the CROO Agent Store as **"Negotiation as a Service."** A listing with no code answering it is worse than no listing — `src/agents/seller/run-cap-provider-listener.ts` is that code.

Run with `npm run agent:cap-provider`. It:

1. Calls `connectWebSocket()` to bring the provider online (required before CAP will accept orders addressed to it — see the gotcha above), then processes any backlog (`listNegotiations({ role: "provider", status: "pending" })`) before subscribing to live `NegotiationCreated` events. Order matters: doing the backlog pass before connecting hits `PROVIDER_NOT_ACCEPTING_ORDERS`.
2. For each inbound negotiation addressed to Parley's `serviceId`: parses the requester's `requirements` string as an optional partial `ServiceRequest` (service, items, target/max price, delivery days, recurring flag) — anything missing or invalid falls back to defaults that reliably reach agreement on the buyer's opening offer, so a bare hire with no `requirements` at all still completes.
3. Runs a **real** Parley negotiation (`runNegotiation`, the same deterministic engine as everywhere else in this repo) between the parsed request and a dedicated reference seller policy (`seller-agent-parley-hire`), producing a signed, platform-attested `Agreement` — or a `NoDeal`, in which case the CAP negotiation is rejected with the reason.
4. Accepts the CAP negotiation (`acceptNegotiationWithFundAddress`), waits for on-chain order confirmation, then waits (up to 10 minutes) for the external requester to call `payOrder` on their own schedule.
5. On payment, delivers the full signed `Agreement` + session as a `"schema"` deliverable via `deliverOrder` — the negotiated, verifiable agreement *is* the product being sold.

**The CAP-level price and the Parley-level price are deliberately decoupled.** The hirer's `fundAmount` (declared at `negotiateOrder` time) is what they pay for *the negotiation service itself* — CAP has no mechanism for a provider to change that after the fact. The number inside the delivered `Agreement.finalOffer.price` is whatever Parley's engine actually negotiated between the parsed request and `hireSellerPolicy`, which can differ from `fundAmount`. This is intentional: you're paying Parley to run a negotiation and hand you a verifiable result, not buying the specific dollar amount written inside it.

Verified live end-to-end against the real CAP network (self-hire test): negotiate → accept → on-chain order created → paid → **delivered → completed**, with real `deliverTxHash` and `clearTxHash`.

### Hiring Parley: the `requirements` contract

```json
{
  "service": "Landing page copy",
  "requestedItems": ["headline set", "feature bullets"],
  "targetPrice": 40,
  "maxPrice": 58,
  "desiredDeliveryDays": 5,
  "recurringClient": false
}
```

All fields optional; the listener fills in sensible defaults for anything missing or malformed. Send this as the CAP negotiation's `requirements` string when calling `negotiateOrder` against Parley's `serviceId`.

## Testing without live CAP credentials

`src/cap/croo-settlement-adapter.test.ts` injects fake `CROOAgentClient` implementations (no network calls) to exercise both the happy path and the price-mismatch rejection path. `createSettlementAdapter()` (`src/cap/settlement-adapter-factory.ts`) falls back to `MockSettlementAdapter` whenever the `CROO_*` env vars aren't fully set, so `npm run dev`, `npm test`, and `npm run build` all work with zero CAP setup — real credentials only change adapter selection, never the negotiation engine.

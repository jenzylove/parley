# Parley — CAP-Negotiate

A structured, machine-verifiable negotiation layer for the [CROO Agent Protocol (CAP)](https://cap.croo.network/).

CAP's own negotiation step is take-it-or-leave-it: a requester asks for a service at its registered price, and a provider accepts or rejects. Parley sits in front of that step and runs a deterministic, multi-round, policy-bounded negotiation between a buyer and a seller agent — counteroffers, rush fees, bundle discounts, round limits, a hard `NO DEAL` outcome — and only then bridges the agreed price onto a real CAP order for on-chain settlement.

Built for the CROO Hackathon.

## Quick start

```bash
npm install
npm run dev       # http://localhost:3000
npm test          # vitest
npm run typecheck
```

No environment variables are required to run the demo. `ANTHROPIC_API_KEY` and the CAP settlement credentials below are both optional — without them, the app falls back to a local explanation template and `MockSettlementAdapter` respectively, so the full negotiation protocol runs with zero secrets.

Copy `.env.example` to `.env` to configure either.

## What's in this repo

- **Negotiation engine** (`src/core/parley-core/negotiation`) — deterministic state machine for `Offer` / `CounterOffer` / `Accept` / `Reject` / `Agreement` / `NoDeal` messages, seller policy validation, and a hard `maxRounds` cutoff. No LLM call sits on the decision path.
- **Commerce lifecycle** (`src/core/parley-core/commerce`, `src/cap/lifecycle.ts`) — maps a completed negotiation onto CAP's order lifecycle (`POSTED → NEGOTIATING → LOCKED → DELIVERING → DELIVERED → SETTLING → SETTLED/FAILED`).
- **CAP settlement** (`src/cap`) — see [SDK methods used](#sdk-methods-used) and `docs/CAP_INTEGRATION.md` below.
- **AI explanation layer** (`src/ai`) — generates human-readable rationale for a negotiation outcome *after* the deterministic engine has decided it. AI cannot change a price, approve an agreement, or bypass a policy constraint.
- **REST API** (`src/app/api/negotiate/*`) — `start`, `message`, `:id`, `:id/history`, all versioned with `protocolVersion`.
- **A2A demo agents** (`src/agents/a2a`) — `BuyerAgent`, `SellerAgent`, `ObserverAgent`, each talking only to the public HTTP API, never importing the engine directly.

Full protocol/architecture docs: [`docs/PROTOCOL.md`](docs/PROTOCOL.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/CAP_INTEGRATION.md`](docs/CAP_INTEGRATION.md).

## SDK methods used

Integration is via [`@croo-network/sdk`](https://www.npmjs.com/package/@croo-network/sdk) (`AgentClient`), in `src/cap/croo-settlement-adapter.ts`:

| Method | Called by | Purpose |
|---|---|---|
| `negotiateOrder` | requester | Opens a CAP negotiation, carrying Parley's already-agreed price as `fundAmount`/`fundToken` (see below) |
| `acceptNegotiationWithFundAddress` | provider | Accepts the negotiation and declares the receiving wallet — triggers CAP's on-chain `createOrder` tx |
| `payOrder` | requester | Locks the agreed USDC into `CAPVault` escrow |
| `deliverOrder` | provider | Submits the locked terms + delivery proof as a `"schema"` deliverable |
| `getDelivery` | requester | Confirms the deliverable is retrievable |

`connectWebSocket` / `NegotiationCreated` etc. are not used in this batch — the current adapter drives both requester and provider synchronously from one process (Parley plays both sides of its own demo negotiation). Listening for external negotiations over WebSocket is the natural next step for third-party A2A composability; see `docs/NEXT_STEPS.md`.

## Integration notes

CAP's `negotiateOrder` has no concept of a buyer/seller-negotiated price — it charges whatever the provider registered for the service, unless the service is registered with `require_fund_transfer=true`, in which case the requester can supply a per-negotiation `fundAmount`/`fundToken`. Parley uses that path as the only way to get its negotiated price onto a CAP order. The adapter also refuses to settle if CAP's negotiation record doesn't echo back the exact `fundAmount`/`fundToken` it sent — the one integrity check CAP itself doesn't provide. Full writeup: [`docs/CAP_INTEGRATION.md`](docs/CAP_INTEGRATION.md).

### Enabling real CAP settlement

All six vars below must be set or the app silently uses `MockSettlementAdapter` (this is intentional — see `src/cap/settlement-adapter-factory.ts`).

1. Register two agents at [agent.croo.network](https://agent.croo.network) — one to act as requester, one as provider.
2. Under the provider agent, register a service with **`require_fund_transfer=true`** (required — see above).
3. Copy each agent's SDK key and the provider's AA wallet address.
4. Deposit test USDC (Base mainnet) into the requester agent's AA wallet.
5. Fill in `.env`:

```bash
CROO_API_URL=https://api.croo.network
CROO_WS_URL=wss://api.croo.network/ws
CROO_REQUESTER_SDK_KEY=croo_sk_...
CROO_PROVIDER_SDK_KEY=croo_sk_...
CROO_SERVICE_ID=...
CROO_PROVIDER_WALLET_ADDRESS=0x...
CROO_USDC_TOKEN_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## License

MIT — see [LICENSE](LICENSE).

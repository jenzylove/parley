# Parley — CAP-Negotiate

A structured, machine-verifiable negotiation layer for the [CROO Agent Protocol (CAP)](https://cap.croo.network/).

CAP's own negotiation step is take-it-or-leave-it: a requester asks for a service at its registered price, and a provider accepts or rejects. Parley sits in front of that step and runs a deterministic, multi-round, policy-bounded negotiation between a buyer and a seller agent — counteroffers, rush fees, bundle discounts, round limits, a hard `NO DEAL` outcome — and only then bridges the agreed price onto a real CAP order for on-chain settlement.

**For sellers:** Parley closes more deals through dynamic, policy-bounded pricing — not by cutting your margin. Your `minimumPrice`/`preferredPrice` floor is enforced by the deterministic engine on every offer; Parley can never accept below it.

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
- **Strategy module** (`src/core/parley-core/negotiation/strategy.ts`) — pure `decideSellerMove` / `decideBuyerMove` functions that only ever see the deciding party's own private policy/request plus the counterparty's last wire message. Shared by the one-shot reference simulation *and* the standalone agent processes below — same logic, two different callers.
- **Seller registry** (`src/api/seller-registry.ts`) — sellers register a policy once (`POST /api/sellers/register`); it is never sent to a buyer. Buyers negotiate by referencing a `sellerAgentId`, not by submitting the seller's policy. See `docs/SPEC.md`.
- **Commerce lifecycle** (`src/core/parley-core/commerce`, `src/cap/lifecycle.ts`) — maps a completed negotiation onto CAP's order lifecycle (`POSTED → NEGOTIATING → LOCKED → DELIVERING → DELIVERED → SETTLING → SETTLED/FAILED`).
- **CAP settlement** (`src/cap`) — see [SDK methods used](#sdk-methods-used) and `docs/CAP_INTEGRATION.md` below.
- **AI explanation layer** (`src/ai`) — generates human-readable rationale for a negotiation outcome *after* the deterministic engine has decided it. AI cannot change a price, approve an agreement, or bypass a policy constraint.
- **REST API** (`src/app/api/negotiate/*`, `src/app/api/sellers/*`) — `negotiate/start` (one-shot), `negotiate/open` + `negotiate/message` (turn-by-turn, for a real counterparty), `sellers/register`, `sellers` (discovery), `sellers/:id/pending`, all versioned with `protocolVersion`. Full spec: `docs/SPEC.md`.
- **A2A demo agents** (`src/agents/a2a`) — `BuyerAgent`, `SellerAgent`, `ObserverAgent`, each talking only to the public HTTP API, never importing the engine directly.
- **Standalone agent processes** (`npm run agent:seller`, `npm run agent:buyer`) — a real second and third OS process, decoupled from the Next.js server, driving a negotiation turn-by-turn over HTTP only. This is the actual proof of A2A composability: either script could be replaced by a different team's agent in a different language, as long as it speaks `docs/SPEC.md`.
- **Inbound CAP provider listener** (`npm run agent:cap-provider`, `src/agents/seller/run-cap-provider-listener.ts`) — answers a real external hire of Parley's "Negotiation as a Service" listing on the CROO Agent Store: listens for `NegotiationCreated`, runs a real signed Parley negotiation, accepts, waits for payment, delivers the signed agreement as the CAP deliverable. See [SDK methods used](#sdk-methods-used) and `docs/CAP_INTEGRATION.md`.

Full protocol/architecture docs: [`docs/SPEC.md`](docs/SPEC.md) (external agent spec), [`docs/PROTOCOL.md`](docs/PROTOCOL.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/CAP_INTEGRATION.md`](docs/CAP_INTEGRATION.md).

## Running two real, separate agent processes

With `npm run dev` running in one terminal:

```bash
npm run agent:buyer    # terminal 2 — opens a negotiation, plays its own counter-offers
npm run agent:seller   # terminal 3 — registers a policy, responds to pending negotiations
```

Each process only ever calls the public HTTP API — neither imports the negotiation engine or the other's code. Run them in either order; both poll until the negotiation resolves.

## Answering a real hire on CAP

```bash
npm run agent:cap-provider
```

This is a long-running process — it needs to actually be running for someone to hire Parley's "Negotiation as a Service" listing on the CROO Agent Store (it is not deployed anywhere persistent by default; Vercel is serverless, so run this locally or on a persistent worker, e.g. a Railway service). On startup it catches up on any backlog of pending negotiations, then listens live. See "Hiring Parley" in `docs/CAP_INTEGRATION.md` for the `requirements` JSON a hirer can send.

## SDK methods used

Integration is via [`@croo-network/sdk`](https://www.npmjs.com/package/@croo-network/sdk) (`AgentClient`):

| Method | Called by | Purpose |
|---|---|---|
| `negotiateOrder` | requester (`croo-settlement-adapter.ts`) | Opens a CAP negotiation, carrying Parley's already-agreed price as `fundAmount`/`fundToken` (see below) |
| `acceptNegotiationWithFundAddress` | provider (`croo-settlement-adapter.ts`, `run-cap-provider-listener.ts`) | Accepts the negotiation and declares the receiving wallet — triggers CAP's on-chain `createOrder` tx |
| `payOrder` | requester (`croo-settlement-adapter.ts`) | Locks the agreed USDC into `CAPVault` escrow |
| `deliverOrder` | provider (`croo-settlement-adapter.ts`, `run-cap-provider-listener.ts`) | Submits the locked terms + delivery proof (or negotiated agreement) as a `"schema"` deliverable |
| `getDelivery` | requester (`croo-settlement-adapter.ts`) | Confirms the deliverable is retrievable |
| `connectWebSocket` / `NegotiationCreated` | provider (`run-cap-provider-listener.ts`) | Brings the provider online and listens for inbound hires from *any* external requester |
| `listNegotiations` | provider (`run-cap-provider-listener.ts`) | Catches up on pending negotiations that arrived before the listener started |
| `rejectNegotiation` | provider (`run-cap-provider-listener.ts`) | Declines a hire with no usable `fundAmount`, or whose parsed terms end in `NoDeal` |
| `getOrder` | provider (`run-cap-provider-listener.ts`) | Polls for on-chain order confirmation and payment before delivering |

## Integration notes

CAP's `negotiateOrder` has no concept of a buyer/seller-negotiated price — it charges whatever the provider registered for the service, unless the service is registered with `require_fund_transfer=true`, in which case the requester can supply a per-negotiation `fundAmount`/`fundToken`. Parley uses that path as the only way to get its negotiated price onto a CAP order. The adapter also refuses to settle if CAP's negotiation record doesn't echo back the exact `fundAmount`/`fundToken` it sent — the one integrity check CAP itself doesn't provide. Full writeup: [`docs/CAP_INTEGRATION.md`](docs/CAP_INTEGRATION.md).

### Enabling real CAP settlement

All six vars below must be set or the app silently uses `MockSettlementAdapter` (this is intentional — see `src/cap/settlement-adapter-factory.ts`).

1. Register two agents at [agent.croo.network](https://agent.croo.network) — one to act as requester, one as provider.
2. Under the provider agent, register a service with **`require_fund_transfer=true`** (required — see above).
3. Copy each agent's SDK key and the provider's AA wallet address.
4. CAP has no testnet — deposit a small amount of real USDC (Base mainnet) into the requester agent's AA wallet. Gas is sponsored by CROO's paymaster, so no ETH is needed. Keep negotiated demo prices low (e.g. $1-5) to keep real-money exposure trivial.
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

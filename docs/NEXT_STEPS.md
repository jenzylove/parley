# Next Steps

## Done this batch

- Seller policy registry (`/api/sellers/register`, `/api/sellers`, `/api/sellers/:id/pending`) — a buyer no longer needs the seller's policy (including its reservation price) just to start a negotiation.
- `recurringClient` moved onto the wire (`OfferPayload`) — a seller's counter-offer strategy no longer needs out-of-band access to the buyer's private `ServiceRequest`.
- `decideSellerMove`/`decideBuyerMove` extracted into `parley-core/negotiation/strategy.ts` — pure functions usable by the hosted one-shot demo *and* any standalone agent process.
- `POST /api/negotiate/open` — turn-by-turn negotiation start, for a real counterparty to play the rest via `/api/negotiate/message` instead of one function resolving both sides.
- Two standalone agent processes (`npm run agent:buyer`, `npm run agent:seller`) — genuinely separate OS processes, HTTP-only, no shared code beyond the wire protocol.
- `docs/SPEC.md` — the external-agent protocol spec, the actual deliverable behind "extract the negotiation schema into an SDK so other CAP agents can adopt it."
- Verified live, end-to-end, against the real CAP network: `npm run agent:buyer` + `npm run agent:seller` as two separate processes reach a real `Agreement`, which flows into `CROOSettlementAdapter` through `negotiateOrder` → `acceptNegotiationWithFundAddress` → `payOrder`. Found and fixed real bugs surfaced only by this live run (see `docs/CAP_INTEGRATION.md` and `docs/ARCHITECTURE.md`): a cross-route in-memory state bug in Next.js dev (Turbopack), CAP requiring a provider to hold an active WebSocket connection, a case-sensitive address comparison bug, and a missing wait for on-chain order confirmation before paying.

## Blocked on funding, not code

- `payOrder` currently fails with `ERC20: transfer amount exceeds balance` — the requester agent's AA wallet has no USDC yet. This is expected (CAP has no testnet); see the README's "Enabling real CAP settlement" section. Once funded with a small amount of real USDC, the full flow above should settle end-to-end with real transaction hashes.

## Recommended Next

- Recruit a real second party: get another team's agent (or a second machine) to run as either side of a negotiation against this one, over the network, using only `docs/SPEC.md`. This is the actual A2A composability proof — everything above just makes it *possible*.
- Replace `run-seller-agent.ts`'s polling loop with `connectWebSocket()` (`NegotiationCreated`-equivalent event on the Parley side would need a small SSE/WebSocket layer added to the negotiate API) for near-real-time response instead of a fixed poll interval.
- Auto-expire a turn-by-turn negotiation that's been idle past a session's offer `expiresAt` (currently only enforced at validation time, not proactively swept) — emit a server-authored `NoDeal` rather than leaving it open forever.
- Sign `Agreement`/`Accept` messages with each agent's CAP wallet key (ECDSA over a canonical hash) so "machine-verifiable agreement" is literally true, not just structurally true.
- Make the UI show the turn-by-turn flow live (poll `/api/negotiate/:id` and animate each round) instead of only rendering the one-shot `/api/negotiate/start` result.

## Later

- Replace in-memory storage with SQLite.
- Add authentication on `/api/sellers/register` (currently any caller can register any `sellerAgentId`) — fine for a hackathon demo, not for a real multi-tenant registry.
- Run the provider side of CAP settlement as its own long-lived process listening on `connectWebSocket()` for `NegotiationCreated` events, so external CAP agents (not just Parley's own demo agents) can hire Parley for real on-chain. Today `CROOSettlementAdapter` drives both sides synchronously from one process for the CAP leg specifically (separate from the Parley-level negotiation, which now does support real separate processes — see above).
- Add OpenAI provider behind the existing `AIProvider` interface if needed.

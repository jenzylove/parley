# Next Steps

## Done this batch

- **Inbound CAP provider listener** (`npm run agent:cap-provider`, `src/agents/seller/run-cap-provider-listener.ts`) — Parley's "Negotiation as a Service" listing on the CROO Agent Store now actually answers a hire. Listens for `NegotiationCreated`, runs a real signed Parley negotiation, accepts, waits for payment, delivers the signed agreement. This is what turns A2A composability from "Parley hiring itself" into real external counterparties, and mints real completed CAP orders toward the 10+ bonus. Verified live end-to-end (self-hire test): negotiate → accept → paid → delivered → completed, real `deliverTxHash`/`clearTxHash`. See `docs/CAP_INTEGRATION.md`.
- Message signing (Ed25519) across the negotiation protocol, plus Parley platform attestation on server-synthesized `Agreement`s. See `docs/SPEC.md`'s "Signing & verification" section.
- Seller policy registry (`/api/sellers/register`, `/api/sellers`, `/api/sellers/:id/pending`) — a buyer no longer needs the seller's policy (including its reservation price) just to start a negotiation.
- `recurringClient` moved onto the wire (`OfferPayload`) — a seller's counter-offer strategy no longer needs out-of-band access to the buyer's private `ServiceRequest`.
- `decideSellerMove`/`decideBuyerMove` extracted into `parley-core/negotiation/strategy.ts` — pure functions usable by the hosted one-shot demo *and* any standalone agent process.
- `POST /api/negotiate/open` — turn-by-turn negotiation start, for a real counterparty to play the rest via `/api/negotiate/message` instead of one function resolving both sides.
- Three standalone agent processes (`npm run agent:buyer`, `npm run agent:seller`, `npm run agent:cap-provider`) — genuinely separate OS processes, HTTP/CAP-only, no shared code beyond the wire protocol.
- `docs/SPEC.md` — the external-agent protocol spec, the actual deliverable behind "extract the negotiation schema into an SDK so other CAP agents can adopt it."
- Verified live, end-to-end, against the real CAP network: `npm run agent:buyer` + `npm run agent:seller` as two separate processes reach a real `Agreement`, which flows into `CROOSettlementAdapter` through `negotiateOrder` → `acceptNegotiationWithFundAddress` → `payOrder`. Found and fixed real bugs surfaced only by this live run (see `docs/CAP_INTEGRATION.md` and `docs/ARCHITECTURE.md`): a cross-route in-memory state bug in Next.js dev (Turbopack), CAP requiring a provider to hold an active WebSocket connection, a case-sensitive address comparison bug, a missing wait for on-chain order confirmation before paying, and (found via the Vercel build) `NODE_ENV`-based test/prod detection being unreliable on platforms that force `NODE_ENV=production` for the whole build — switched to `process.env.VITEST`.

## Recommended Next

- **Get the listener running persistently and recruit real hirers.** `npm run agent:cap-provider` needs to actually be running for someone to hire Parley — it's not deployed anywhere persistent yet (Vercel is serverless; this needs a long-lived process, e.g. a Railway worker service, or just running it locally during the judging window). Once it's up, reach out to other hackathon teams to hire Parley's listing — that's what turns this from "code that could handle external hires" into actual diverse A2A relationship data.
- Auto-expire a turn-by-turn negotiation that's been idle past a session's offer `expiresAt` (currently only enforced at validation time, not proactively swept) — emit a server-authored `NoDeal` rather than leaving it open forever.
- Make the UI show the turn-by-turn flow live (poll `/api/negotiate/:id` and animate each round) instead of only rendering the one-shot `/api/negotiate/start` result.
- Reconcile the CAP-level `fundAmount` and the Parley-level negotiated price in the inbound listener (currently intentionally decoupled — see `docs/CAP_INTEGRATION.md`) if a tighter "you get exactly what you paid for" story is wanted later.

## Later

- Replace in-memory storage with SQLite.
- Add authentication on `/api/sellers/register` (currently any caller can register any `sellerAgentId`) — fine for a hackathon demo, not for a real multi-tenant registry.
- Add OpenAI provider behind the existing `AIProvider` interface if needed.

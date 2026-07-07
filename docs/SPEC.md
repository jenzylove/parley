# Parley Negotiation Protocol — Spec for External Agents

Protocol version: `parley-negotiation/0.1`

This document is the adoption target for the stretch goal in `PROJECT.md`: "extract the negotiation schema into an SDK so other CAP agents can adopt it." Anything here is implementable against the public HTTP API alone — you do not need this repo's TypeScript, and you do not need to trust it. A conforming agent can be written in any language.

Parley itself ships two reference implementations of an external agent — `src/agents/seller/run-seller-agent.ts` and `src/agents/buyer/run-buyer-agent.ts` (`npm run agent:seller` / `npm run agent:buyer`) — each a **separate OS process** that speaks only this wire protocol, never importing the negotiation engine directly. Use them as a working example alongside this spec.

## Why a protocol, not just a chatbot

CAP's own `negotiateOrder` is accept/reject against a provider's registered price — see `docs/CAP_INTEGRATION.md`. There is no multi-round, structured bargaining step anywhere in CAP itself. Parley is that missing layer: a small state machine that two independent agents can drive to a mutually-agreed, machine-verifiable price, which is then bridged onto a real CAP order (fund-transfer negotiation) once both sides accept.

## Core guarantee: nobody sees the counterparty's reservation price

- A seller's `minimumPrice` and `preferredPrice` are **never** sent to a buyer, never returned by any negotiation endpoint, and never appear in `/api/sellers` discovery listings.
- A buyer's `maxPrice` is never sent to the seller.
- The only party that ever sees both sides' private numbers is Parley's own registry/negotiation service — the same trust boundary a real marketplace operator occupies. Each side only ever receives protocol *messages* (offers, counteroffers, accept/reject) and the final `Agreement`.

If you find a response that violates this, it's a bug — file it.

## Message types

Six message types, exchanged as `ProtocolMessage<TPayload>`:

```ts
type ProtocolMessage<TPayload> = {
  id: string;
  sender: string;      // agentId
  receiver: string;    // agentId
  timestamp: string;   // ISO 8601
  messageType: "Offer" | "CounterOffer" | "Accept" | "Reject" | "Agreement" | "NoDeal";
  payload: TPayload;
  signature?: string;  // base64 Ed25519, see "Signing & verification" below
};
```

### OfferPayload (Offer, CounterOffer)

```ts
type OfferPayload = {
  negotiationId: string;
  price: number;
  currency: "USDC";
  deliveryDays: number;
  bundleItems: string[];
  paymentSchedule: "upfront";
  expiresAt: string;       // ISO 8601, must be in the future
  round: number;            // 1-indexed
  recurringClient: boolean; // buyer self-declares once, on the opening offer; carried forward on every subsequent payload
};
```

`recurringClient` is on the wire deliberately: a seller's counter-offer strategy must never need out-of-band access to the buyer's private request object. Everything a seller needs to decide its next move is either its own policy or this payload.

### AcceptPayload (Accept)

```ts
type AcceptPayload = { negotiationId: string; acceptedMessageId: string; reason: string };
```

`acceptedMessageId` must reference a real `Offer`/`CounterOffer` message id in the session's history — the server resolves the actual offer by id, not "whatever came last."

### AgreementPayload (Agreement)

Synthesized by the server immediately after a valid `Accept`, never authored by either counterparty (only the party holding the seller's registered policy can honestly compute `policyExplanation`):

```ts
type AgreementPayload = {
  agreementId: string;
  negotiationId: string;
  buyerAgentId: string;
  sellerAgentId: string;
  service: string;
  finalOffer: OfferPayload;
  acceptedAt: string;
  expiresAt: string;
  roundsUsed: number;
  savings: number;
  reason: string;
  policyExplanation: {
    acceptedBecause: string;
    constraintsApplied: string[];
    finalPolicyFloor: number;
    buyerSavingsVsSellerPreferred: number;
  };
};
```

### NoDealPayload (Reject, NoDeal)

```ts
type NoDealPayload = { negotiationId: string; reason: string; finalRound: number };
```

## Signing & verification

Every `Offer`, `CounterOffer`, `Accept`, and `NoDeal` a real agent sends must be signed with an Ed25519 keypair it generates and holds itself — nobody else ever sees the private half, including Parley's server. `SellerPolicy.publicKey` and `ServiceRequest.buyerPublicKey` are how each side declares the key its signatures will verify against; the server checks every incoming message's `signature` against the claimed `sender`'s declared key before accepting a state transition. An unsigned or wrong-key message is rejected with an error containing `"signature"` — it never reaches the state machine's turn/round logic.

This is what makes "machine-verifiable agreement" literal rather than aspirational: a message claiming to be from `seller-agent-copywriter` is only valid if it verifies against that exact agent's own key. See `src/core/parley-core/negotiation/signing.ts` for the primitives (`generateAgentKeyPair`, `signMessage`, `verifyMessageSignature`) — plain Ed25519 over a canonical (recursively key-sorted) JSON serialization, no framework, portable to any language with Ed25519 support.

`Agreement` messages are the one exception: they're synthesized by Parley's server (see below), not sent by either counterparty, so the outer envelope's `signature` is unset. Instead, `AgreementPayload.platformAttestation` (`{ publicKey, signature }`) is Parley's own platform keypair — generated once per server process — signing over `{ agreementId, negotiationId, finalOffer, policyExplanation }`. This is a deliberately different claim: not "the seller agreed to this" (the seller already proved that via their `Accept` signature) but "Parley's registry, which holds the seller's private policy in trust, independently attests this explanation was computed honestly from it."

CAP's own AA wallet keys are not used for any of this — CROO's backend holds those via a delegated session key and never exposes them to SDK callers (see `docs/CAP_INTEGRATION.md`), so "sign with your CAP wallet" isn't something a caller of that SDK can actually do. This signing scheme is Parley-native and sits one layer above CAP: it protects the negotiation, CAP protects the settlement.

## State machine

```
awaiting_buyer_offer --Offer(buyer)--> awaiting_seller_response
awaiting_seller_response --CounterOffer(seller)--> awaiting_buyer_response
awaiting_buyer_response --CounterOffer(buyer)--> awaiting_seller_response
(awaiting_seller_response | awaiting_buyer_response) --Accept--> [server appends Agreement] --> agreement (terminal)
(awaiting_seller_response | awaiting_buyer_response) --Reject|NoDeal--> no_deal (terminal)
```

Rules the server enforces on every message, regardless of who sends it:

- Messages must be sent by the party whose turn it is, to the correct counterparty (`receiver` must equal the other side's agentId).
- `CounterOffer.round` cannot exceed the session's `maxRounds`.
- No messages are accepted once a session reaches `agreement` or `no_deal`.
- An `Accept` must reference a real prior offer by id.

## Seller registry (kills the price-leak, makes a seller a real independent party)

A buyer never receives a seller's policy. Instead:

### `POST /api/sellers/register`

Body: a full `SellerPolicy` (kept **only** server-side after this call).

```json
{ "sellerAgentId": "...", "service": "...", "currency": "USDC", "minimumPrice": 44, "preferredPrice": 64, "standardDeliveryDays": 5, "rushFee": 8, "bundleDiscount": 10, "recurringClientDiscount": 4, "maximumWorkload": 6, "currentWorkload": 3, "preferredPaymentSchedule": "upfront", "maxRounds": 3 }
```

Response: `{ "protocolVersion": "...", "sellerAgentId": "..." }`

### `GET /api/sellers`

Public discovery — no price fields, ever:

```json
{ "protocolVersion": "...", "sellers": [{ "sellerAgentId": "...", "service": "...", "currency": "USDC", "standardDeliveryDays": 5, "maxRounds": 3 }] }
```

### `GET /api/sellers/:sellerAgentId/pending`

Lets a standalone seller process discover its own pending work without an out-of-band `negotiationId`:

```json
{ "protocolVersion": "...", "sellerAgentId": "...", "negotiationIds": ["negotiation_abc123"] }
```

## Negotiation endpoints

### `POST /api/negotiate/start` — one-shot reference resolution

Body: `{ "request": ServiceRequest, "sellerAgentId": string }`. Resolves an entire negotiation synchronously using Parley's own reference strategies for both sides, builds `LockedTerms`, and runs it through CAP settlement. Useful for fast demos and integration tests; **not required** for a real external agent — see `open` + `message` below.

### `POST /api/negotiate/open` — turn-by-turn, for a real counterparty

Body: `{ "request": ServiceRequest, "sellerAgentId": string, "openingOffer": OfferMessage }`. `openingOffer` must be built and signed by the buyer's own process (`createOpeningOffer` in `strategy.ts`, or your own equivalent) — Parley never constructs the buyer's first move on its behalf, since a message Parley authored wouldn't actually be signable by the buyer. The buyer picks its own `negotiationId` (any unique string, e.g. `crypto.randomUUID()`) and signs against it before this call even happens. The server verifies the signature against `request.buyerPublicKey`, then returns the live session in `awaiting_seller_response` — nothing auto-resolves. Whoever is playing the seller (a standalone process, another team's agent) must poll `/api/sellers/:id/pending` or the session directly, and respond via `/api/negotiate/message`.

### `POST /api/negotiate/message`

Body: `{ "negotiationId": string, "message": ProtocolMessage }`. Submits your own next move (`CounterOffer`, `Accept`, or `Reject`/`NoDeal`). When your message is a valid `Accept`, the server appends the synthesized `Agreement`, builds `LockedTerms`, and runs CAP settlement — the response's `commerce.order` reflects the result immediately.

### `GET /api/negotiate/:id`, `GET /api/negotiate/:id/history`

Session/state and full message history, unchanged shape throughout a negotiation's life.

## Writing a conforming agent in any language

1. Generate an Ed25519 keypair and hold the private half yourself, forever — never send it anywhere, not even to Parley. Register your policy including the public half (`POST /api/sellers/register`) if you're a seller, or embed it in your `ServiceRequest.buyerPublicKey` if you're a buyer. Never send price internals to the counterparty.
2. Buyer builds and signs its own opening `Offer` (own `negotiationId`, own key) and opens with it (`POST /api/negotiate/open`). Seller discovers it (`GET /api/sellers/:id/pending`) or is told the `negotiationId` out of band.
3. Whoever's turn it is: fetch the session, look at the last `Offer`/`CounterOffer` in `messageHistory`, decide accept/counter/walk using **only your own private numbers and the wire payload** (this is the whole point — see `decideSellerMove`/`decideBuyerMove` in `src/core/parley-core/negotiation/strategy.ts` for the reference decision logic, which you're free to reimplement differently), sign whatever message you send with your own key, and `POST /api/negotiate/message`. An unsigned or wrongly-signed message is rejected before it's even evaluated against the state machine.
4. Stop when `session.currentState` is `agreement` or `no_deal`. On `agreement`, `commerce.order.settlement` carries the real CAP transaction hashes (see `docs/CAP_INTEGRATION.md`), and the `Agreement`'s `platformAttestation` is independently verifiable against Parley's own platform public key.

Nothing above requires importing this repo's code. That's deliberate — it's the difference between a demo and a protocol.

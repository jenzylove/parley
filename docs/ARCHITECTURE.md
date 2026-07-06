# Architecture

Parley is a protocol-first negotiation service for agent-to-agent price negotiation.

## Current Shape

- `src/core/parley-core`: deterministic protocol engine, message types, session state, validation, and state-machine transitions.
- `src/core/parley-core/commerce`: immutable locked terms, placeholder delivery proof, and commerce order state.
- `src/core/parley-core/market`: demo-data market pricing, recommended offer, and savings calculations.
- `src/api`: protocol API service, versioned response envelope, and in-memory negotiation store.
- `src/app/api/negotiate/*`: REST route handlers.
- `src/cap`: settlement adapter boundary. `MockSettlementAdapter` for local/test runs, `CROOSettlementAdapter` for real CAP settlement via `@croo-network/sdk`, selected by `createSettlementAdapter()` based on env vars.
- `src/ai`: provider-agnostic explanation layer. Anthropic is supported behind `AIProvider`; local fallback keeps the demo runnable without secrets.
- `src/app/page.tsx`: demo UI. It consumes `/api/negotiate/start` instead of importing the engine directly.
- `src/agents`: sample inputs plus A2A demo agents that communicate through the public protocol API.

## A2A Diagram

```txt
Buyer Agent
  |
  v
Parley Protocol/API
  |
  v
Seller Agent
  |
  v
Settlement Adapter
  |
  v
Observer Agent
```

`BuyerAgent`, `SellerAgent`, and `ObserverAgent` are independent demo clients. They do not import or call the negotiation engine. They interact through `/api/negotiate/start`, `/api/negotiate/:id`, and `/api/negotiate/:id/history`.

## Protocol Flow

1. Buyer submits `Offer`.
2. Deterministic engine validates schema and state transition.
3. Constraint solver accepts, counters, or terminates.
4. Policy explainability records which seller constraints mattered.
5. Market intelligence calculates market average, market range, recommended offer, and savings.
6. Successful negotiation emits immutable `LockedTerms`.
7. A typed placeholder `DeliveryProof` is attached.
8. Settlement runs through an adapter and advances the commerce order from `LOCKED` to `SETTLED` or `FAILED`.
9. Every protocol message is persisted in `messageHistory`.
10. AI explanations are generated after deterministic protocol decisions.

The negotiation engine does not call Anthropic, OpenAI, CAP, wallets, or UI code. AI does not influence pricing decisions.

## API Assumptions

Storage is currently in-memory for hackathon speed. It is suitable for a single demo process and integration tests, but not production persistence.

Every API response includes:

```txt
protocolVersion: parley-negotiation/0.1
```

See `docs/API.md` for request and response examples. See `docs/PROTOCOL.md` for the Parley-to-CROO lifecycle mapping.

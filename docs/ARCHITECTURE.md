# Architecture

Parley is a protocol-first negotiation service for agent-to-agent price negotiation.

## Current Shape

- `src/core/parley-core`: deterministic protocol engine (`negotiation/engine.ts`), pure decision/strategy functions (`negotiation/strategy.ts`), message types, session state, validation, and state-machine transitions.
- `src/core/parley-core/commerce`: immutable locked terms, placeholder delivery proof, and commerce order state.
- `src/core/parley-core/market`: demo-data market pricing, recommended offer, and savings calculations.
- `src/api`: protocol API service, seller policy registry (`seller-registry.ts`), versioned response envelope, and in-memory negotiation store.
- `src/app/api/negotiate/*`, `src/app/api/sellers/*`: REST route handlers.
- `src/cap`: settlement adapter boundary. `MockSettlementAdapter` for local/test runs, `CROOSettlementAdapter` for real CAP settlement via `@croo-network/sdk`, selected by `createSettlementAdapter()` based on env vars.
- `src/ai`: provider-agnostic explanation layer. Anthropic is supported behind `AIProvider`; local fallback keeps the demo runnable without secrets.
- `src/app/page.tsx`: demo UI. It consumes `/api/a2a/demo` instead of importing the engine directly.
- `src/agents`: sample inputs, in-process A2A demo agents, and standalone agent processes (`agents/buyer/run-buyer-agent.ts`, `agents/seller/run-seller-agent.ts`) that communicate through the public protocol API only.

## A2A Diagram

```txt
Buyer Process (npm run agent:buyer)
  |
  v  HTTP only
Parley Protocol/API  <-- seller registry (policy never leaves the server)
  ^
  |  HTTP only
Seller Process (npm run agent:seller)
```

Two genuinely separate OS processes, each speaking only the HTTP API in `docs/SPEC.md`. Neither imports the negotiation engine, the seller registry, or the other process's code — only the shared, pure `decideSellerMove`/`decideBuyerMove` functions from `parley-core/negotiation/strategy.ts`, which any other implementation is free to replace.

The in-process demo clients `BuyerAgent`/`SellerAgent`/`ObserverAgent` (used by `/api/a2a/demo` for the one-shot showcase) also interact only through `/api/negotiate/start`, `/api/sellers/register`, `/api/negotiate/:id`, and `/api/negotiate/:id/history` — they do not call the negotiation engine directly either, but they run in-process for demo convenience.

## Protocol Flow

1. Seller registers its policy once (`POST /api/sellers/register`) — never sent to the buyer.
2. Buyer submits opening `Offer`, referencing the seller by `sellerAgentId` only (`POST /api/negotiate/start` for a one-shot resolution, or `POST /api/negotiate/open` to let a real counterparty play it turn-by-turn).
3. Deterministic engine validates schema and state transition on every message.
4. Each side's next move — accept, counter, or walk — is decided by `decideSellerMove`/`decideBuyerMove`, using only that side's own private data and the counterparty's last wire message.
5. Policy explainability records which seller constraints mattered, synthesized server-side immediately after a valid `Accept` (only the registry holds the seller's policy needed to compute it honestly).
6. Market intelligence calculates market average, market range, recommended offer, and savings.
7. Successful negotiation emits immutable `LockedTerms`.
8. A typed placeholder `DeliveryProof` is attached.
9. Settlement runs through an adapter and advances the commerce order from `LOCKED` to `SETTLED` or `FAILED`.
10. Every protocol message is persisted in `messageHistory`.
11. AI explanations are generated after deterministic protocol decisions.

The negotiation engine does not call Anthropic, OpenAI, CAP, wallets, or UI code. AI does not influence pricing decisions.

## API Assumptions

Storage is currently in-memory for hackathon speed. It is suitable for a single demo process and integration tests, but not production persistence.

**In dev mode, in-memory singletons must be anchored to `globalThis`** (`src/api/global-singleton.ts`), not a plain module-scope `const store = new Map()`. Next.js's dev bundler (Turbopack) compiles each route handler file into its own isolated module graph, so a plain module-scope Map ends up as a *different instance per route* — a write in `/api/sellers/register` would be invisible to `/api/sellers`. This was found by testing cross-route calls with real HTTP requests against `npm run dev`, not by the vitest suite (which calls service functions directly in one process and never exercises Next's per-route compilation). `getGlobalSingleton()` works around it the same way a Prisma client singleton usually does in Next.js apps.

Every API response includes:

```txt
protocolVersion: parley-negotiation/0.1
```

See `docs/API.md` for request and response examples. See `docs/SPEC.md` for the full external-agent protocol spec. See `docs/PROTOCOL.md` for the Parley-to-CROO lifecycle mapping.

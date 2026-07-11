# Deploying Parley

## Why not Vercel

Parley keeps its seller registry and negotiation history in process memory
(`src/api/global-singleton.ts`), anchored to `globalThis`. That is correct and
fast on a **single long-lived Node process** — which is exactly what `next dev`
and `next start` give you.

It does **not** work on Vercel's serverless model. There, each request can be
served by a different, short-lived function instance, so a write from one
request (e.g. registering a seller via `/start`) is invisible to the next
request (e.g. reading `/dashboard` or `/api/sellers`). The result: onboarding
appears to succeed, but the dashboard stays empty and the go-live policy fetch
can't find the seller.

The fix is to run Parley as **one always-on process**. Two supported paths:

## Option A — Render (simplest)

The repo ships a `render.yaml` blueprint.

1. Push this repo to GitHub.
2. In Render: **New +** → **Blueprint** → point it at this repo.
3. After the first deploy, set the secret env vars in the dashboard:
   - `PARLEY_INTERNAL_KEY` — any random string; must match the value in the
     `.env` of whoever runs the provider listener against this server.
   - `ANTHROPIC_API_KEY` *(optional)* — without it, negotiation explanations
     fall back to a deterministic local template.

`render.yaml` pins one instance on purpose (`numInstances: 1`) — scaling out
would re-introduce the split-brain state problem, since instances don't share
memory.

## Option B — Railway / Fly.io / any container host

The repo ships a `Dockerfile` (single process, secrets read from the host's
runtime env, never baked into the image).

```bash
# Railway: railway up   |   Fly: fly launch && fly deploy
```

Set `PARLEY_INTERNAL_KEY` (and optionally `ANTHROPIC_API_KEY`) in the host's
dashboard. Keep it to a single instance for the same reason as above.

## Env vars the web server needs

| Var | Required | Purpose |
| --- | --- | --- |
| `PARLEY_INTERNAL_KEY` | for go-live | Gates `GET /api/sellers/[id]/policy`, which the provider listener fetches at startup. |
| `ANTHROPIC_API_KEY` | optional | AI explanations; deterministic fallback without it. |
| `NODE_VERSION` | recommended | Pin to `20` (also set via `.node-version`). |

**Deliberately not set on the public server:** the real `CROO_*` settlement
secrets. Leaving them unset keeps the public site on the free, instant
`MockSettlementAdapter` (no real funds move). Real on-chain settlement is
exercised by the standalone agent processes (`npm run agent:cap-provider`,
`npm run cap:smoke`) running locally with their own credentials — those
credentials never touch the web server. See the `/start` success screen for the
exact command.

## Caveats

- **Free-tier cold starts**: Render/Railway free tiers spin the instance down
  after inactivity. On restart, in-memory state resets to empty. That is fine
  for a demo (state persists for the duration of a session), but for durable
  multi-session persistence you would move the registry/history behind an
  external store (e.g. Upstash Redis / Vercel KV) implemented behind the
  existing `getGlobalSingleton` seam.

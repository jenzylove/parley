# Portable single-process image for hosts other than Render (Railway, Fly.io,
# any container platform). Same rationale as render.yaml: Parley's in-memory
# store needs ONE long-lived process, which a container instance provides and
# Vercel serverless does not.
#
# Secrets are never baked in — they are read from the host's runtime env
# (.env is excluded via .dockerignore). Set PARLEY_INTERNAL_KEY (and optionally
# ANTHROPIC_API_KEY) in your host's dashboard.

FROM node:20-slim

WORKDIR /app

# Install dependencies against the committed lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Build (runs typecheck + tests + next build, the repo's standard gate).
COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]

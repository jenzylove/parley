# CAP-Negotiate

## Vision

CAP-Negotiate is an open negotiation protocol built on top of the CROO Agent Protocol (CAP).

Instead of AI agents accepting fixed prices or failing transactions, CAP-Negotiate enables structured, machine-verifiable negotiations before on-chain settlement.

This is NOT simply another AI agent.

The goal is to introduce a reusable negotiation layer that any CAP-compatible agent can adopt.

Think HTTP for negotiation.

---

# Hackathon

CROO Hackathon

Requirements:

- Build an AI agent
- Integrate CAP
- On-chain settlement
- List on CROO Agent Store
- Open source
- Demonstrate real A2A composability

Judging priorities:

- Innovation
- Technical execution
- CAP integration
- A2A composability
- Commercial viability
- Demo quality
- Ecosystem value

Our objective is first place.

---

# Core Problem

Today AI agents usually expose fixed pricing.

A buyer either:

- accepts

or

- walks away.

There is no structured negotiation layer.

---

# Solution

Create a negotiation protocol that sits between buyer and seller agents.

Buyer Agent

↓

CAP-Negotiate

↓

Seller Agent

↓

Agreement

↓

CAP Settlement

Negotiation produces a machine-readable agreement rather than free-form text.

---

# MVP

The MVP should demonstrate one complete negotiation lifecycle.

Flow:

Buyer Agent

↓

Requests services

↓

Negotiation begins

↓

Counteroffers exchanged

↓

Agreement reached

↓

Agreement signed

↓

CAP payment executed

↓

Transaction complete

---

# Architecture

Frontend

- Next.js
- TypeScript
- Tailwind
- shadcn/ui

Backend

- Next.js API Routes

Storage

- SQLite or JSON for MVP

Blockchain

- CAP integration
- USDC settlement

LLM

- OpenAI

---

# Negotiation Schema

Negotiation must use structured objects instead of natural language.

Example fields:

- price
- currency
- delivery_time
- bundle_items
- payment_schedule
- expiration
- constraints

The protocol should be extensible.

---

# Negotiation Policy

Each seller agent publishes a policy.

Example:

minimum_price

preferred_price

rush_fee

bundle_discount

payment_terms

The LLM reasons within these constraints.

---

# Important Design Decision

Do NOT allow infinite LLM conversations.

Negotiation should terminate after a configurable number of rounds.

Example:

max_rounds = 3

If agreement is impossible:

Return NO DEAL.

---

# Explainability

Every accepted agreement should generate:

- Final price
- Savings
- Reasoning
- Negotiation history

Example:

Saved 4 USDC

Reason:
Bundle discount + flexible delivery.

---

# Security

Protect against:

- prompt injection
- reservation price leakage
- invalid offers
- expired offers

---

# Scope

Do NOT build:

- DAO
- Token
- Lending
- Capital markets
- Insurance
- Reputation system

These belong in future versions.

---

# Stretch Goal

Extract the negotiation schema into an SDK so other CAP agents can adopt it.

This should be presented as a protocol extension rather than a standalone chatbot.

---

# Coding Guidelines

Prefer:

- clean architecture
- reusable components
- small files
- strong typing
- comments only when necessary

Always explain major architectural decisions before implementing them.

Ask before introducing large dependencies or changing project structure.
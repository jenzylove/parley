// Standalone seller process. Run in its own terminal, entirely decoupled
// from the Next.js dev server process — it only ever talks to Parley over
// the public HTTP API, using the exact same decideSellerMove() function the
// hosted one-shot demo uses. That's the proof the negotiation strategy is
// portable to an independent counterparty, not just two classes sharing a
// process. A different team's seller agent could replace this file entirely,
// in any language, as long as it speaks the same wire protocol (docs/SPEC.md).
//
// Run with: npm run agent:seller
//
// Env:
//   PARLEY_BASE_URL   default http://localhost:3000

import { buildAcceptMessage, buildNoDealMessage, decideSellerMove } from "../../core/parley-core/negotiation/strategy";
import { generateAgentKeyPair } from "../../core/parley-core/negotiation/signing";
import type { NegotiationSession, OfferMessage, SellerPolicy } from "../../core/parley-core/negotiation/types";
import { sampleSellerPolicy } from "./sample-seller";

const baseUrl = process.env.PARLEY_BASE_URL ?? "http://localhost:3000";
const pollIntervalMs = 1500;

// Generated fresh for this process. The private key never leaves it — only
// the public key (embedded in the registered policy below) is shared, so
// Parley's server can verify this seller's signatures without ever holding
// anything that could forge them.
const { publicKey, privateKey } = generateAgentKeyPair();
const policy: SellerPolicy = { ...sampleSellerPolicy, publicKey };

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`Parley API request failed with status ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function registerPolicy(): Promise<void> {
  await readJson(
    await fetch(`${baseUrl}/api/sellers/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(policy),
    }),
  );
  console.log(`[seller] registered policy for ${policy.sellerAgentId} at ${baseUrl}`);
}

async function listPending(): Promise<string[]> {
  const response = await readJson<{ negotiationIds: string[] }>(
    await fetch(`${baseUrl}/api/sellers/${policy.sellerAgentId}/pending`),
  );
  return response.negotiationIds;
}

function lastOffer(session: NegotiationSession): OfferMessage {
  const offer = [...session.messageHistory]
    .reverse()
    .find((message): message is OfferMessage => message.messageType === "Offer" || message.messageType === "CounterOffer");
  if (!offer) throw new Error(`negotiation ${session.negotiationId} has no offer yet`);
  return offer;
}

async function respondTo(negotiationId: string): Promise<void> {
  const { session } = await readJson<{ session: NegotiationSession }>(
    await fetch(`${baseUrl}/api/negotiate/${negotiationId}`),
  );

  const offer = lastOffer(session);
  const move = decideSellerMove(policy, session, offer, privateKey);

  if (move.type === "accept") {
    const accept = buildAcceptMessage(policy.sellerAgentId, session.buyerAgentId, negotiationId, offer.id, move.reason, privateKey);
    await readJson(
      await fetch(`${baseUrl}/api/negotiate/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, message: accept }),
      }),
    );
    console.log(`[seller] ACCEPTED ${negotiationId} at ${offer.payload.price} ${offer.payload.currency}`);
    return;
  }

  if (move.type === "walk") {
    const noDeal = buildNoDealMessage(policy.sellerAgentId, session.buyerAgentId, session, move.reason, privateKey);
    await readJson(
      await fetch(`${baseUrl}/api/negotiate/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, message: noDeal }),
      }),
    );
    console.log(`[seller] WALKED AWAY from ${negotiationId}: ${move.reason}`);
    return;
  }

  await readJson(
    await fetch(`${baseUrl}/api/negotiate/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ negotiationId, message: move.message }),
    }),
  );
  console.log(`[seller] countered ${negotiationId} at ${move.message.payload.price} ${move.message.payload.currency}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  await registerPolicy();
  console.log("[seller] polling for negotiations awaiting my response... (Ctrl+C to stop)");

  for (;;) {
    const pending = await listPending();

    for (const negotiationId of pending) {
      try {
        await respondTo(negotiationId);
      } catch (error) {
        console.error(`[seller] failed to respond to ${negotiationId}:`, error instanceof Error ? error.message : error);
      }
    }

    await sleep(pollIntervalMs);
  }
}

main().catch((error) => {
  console.error("[seller] fatal error:", error);
  process.exit(1);
});

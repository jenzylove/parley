// Standalone buyer process. Run in its own terminal, separate from both the
// Next.js server and the seller process — it only ever talks to Parley over
// the public HTTP API. Opens a negotiation, then polls and plays its own
// counter-offers using decideBuyerMove() until the negotiation reaches
// agreement or no_deal.
//
// Run with: npm run agent:buyer
//
// Env:
//   PARLEY_BASE_URL        default http://localhost:3000
//   PARLEY_SELLER_AGENT_ID default sampleSellerPolicy.sellerAgentId (see ../seller/sample-seller.ts)

import { randomUUID } from "node:crypto";
import { buildAcceptMessage, buildNoDealMessage, createOpeningOffer, decideBuyerMove } from "../../core/parley-core/negotiation/strategy";
import { generateAgentKeyPair } from "../../core/parley-core/negotiation/signing";
import type { NegotiationSession, OfferMessage, ServiceRequest } from "../../core/parley-core/negotiation/types";
import { sampleBuyerRequest } from "./sample-buyer";
import { sampleSellerPolicy } from "../seller/sample-seller";

const baseUrl = process.env.PARLEY_BASE_URL ?? "http://localhost:3000";
const sellerAgentId = process.env.PARLEY_SELLER_AGENT_ID ?? sampleSellerPolicy.sellerAgentId;
const pollIntervalMs = 1500;

// Generated fresh for this process, never sent to the server or the seller —
// only the derived public key (embedded in `request` below) is shared. This
// is what makes every message this agent sends independently verifiable: the
// server checks it against this key, which only this process ever held.
const { publicKey, privateKey } = generateAgentKeyPair();
const request: ServiceRequest = { ...sampleBuyerRequest, buyerPublicKey: publicKey };

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`Parley API request failed with status ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function lastOffer(session: NegotiationSession): OfferMessage {
  const offer = [...session.messageHistory]
    .reverse()
    .find((message): message is OfferMessage => message.messageType === "Offer" || message.messageType === "CounterOffer");
  if (!offer) throw new Error(`negotiation ${session.negotiationId} has no offer yet`);
  return offer;
}

async function getSession(negotiationId: string): Promise<{ session: NegotiationSession; commerce?: unknown }> {
  return readJson(await fetch(`${baseUrl}/api/negotiate/${negotiationId}`));
}

async function postMessage(negotiationId: string, message: unknown): Promise<void> {
  await readJson(
    await fetch(`${baseUrl}/api/negotiate/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ negotiationId, message }),
    }),
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const negotiationId = randomUUID();
  const openingOffer = createOpeningOffer(request, negotiationId, sellerAgentId, privateKey);

  const opened = await readJson<{ session: NegotiationSession }>(
    await fetch(`${baseUrl}/api/negotiate/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, sellerAgentId, openingOffer }),
    }),
  );
  console.log(`[buyer] opened negotiation ${opened.session.negotiationId} with seller ${sellerAgentId} (signed, key never left this process)`);

  for (;;) {
    const { session, commerce } = await getSession(negotiationId);

    if (session.currentState === "agreement") {
      console.log(`[buyer] AGREEMENT reached after ${session.currentRound} round(s).`);
      console.log(JSON.stringify(commerce, null, 2));
      return;
    }

    if (session.currentState === "no_deal") {
      console.log(`[buyer] NO DEAL after ${session.currentRound} round(s).`);
      return;
    }

    if (session.currentState !== "awaiting_buyer_response") {
      await sleep(pollIntervalMs);
      continue;
    }

    const offer = lastOffer(session);
    const move = decideBuyerMove(request, session, offer, privateKey);

    if (move.type === "accept") {
      await postMessage(
        negotiationId,
        buildAcceptMessage(request.buyerAgentId, sellerAgentId, negotiationId, offer.id, move.reason, privateKey),
      );
      console.log(`[buyer] ACCEPTED at ${offer.payload.price} ${offer.payload.currency}`);
      continue;
    }

    if (move.type === "walk") {
      await postMessage(negotiationId, buildNoDealMessage(request.buyerAgentId, sellerAgentId, session, move.reason, privateKey));
      console.log(`[buyer] WALKED AWAY: ${move.reason}`);
      return;
    }

    await postMessage(negotiationId, move.message);
    console.log(`[buyer] countered at ${move.message.payload.price} ${move.message.payload.currency}`);
    await sleep(pollIntervalMs);
  }
}

main().catch((error) => {
  console.error("[buyer] fatal error:", error);
  process.exit(1);
});

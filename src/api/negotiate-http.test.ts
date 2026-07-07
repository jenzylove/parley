import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { sampleBuyerRequest } from "../agents/buyer/sample-buyer";
import { sampleSellerPolicy } from "../agents/seller/sample-seller";
import { BuyerAgent } from "../agents/a2a/buyer-agent";
import { HttpParleyApiClient } from "../agents/a2a/parley-api-client";
import { ObserverAgent } from "../agents/a2a/observer-agent";
import { SellerAgent } from "../agents/a2a/seller-agent";
import { buildAcceptMessage, buildNoDealMessage, createOpeningOffer, generateAgentKeyPair } from "../core/parley-core";
import type { NegotiationSession, OfferMessage } from "../core/parley-core";
import { decideBuyerMove, decideSellerMove } from "../core/parley-core";
import {
  applyNegotiationMessage,
  getNegotiationHistory,
  getNegotiationSession,
  getPendingForSeller,
  openNegotiation,
  startNegotiation,
  versionedError,
} from "./negotiate-service";
import { registerSellerPolicy, listPublicSellers, clearSellerRegistryForTests } from "./seller-registry";
import { clearNegotiationsForTests } from "./store";
import { PROTOCOL_VERSION } from "./protocol-version";

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createProtocolTestServer() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const path = url.pathname;

    try {
      if (request.method === "POST" && path === "/api/sellers/register") {
        const policy = await readJson(request);
        const validation = registerSellerPolicy(policy);
        writeJson(
          response,
          validation.ok ? 200 : 400,
          validation.ok
            ? { protocolVersion: PROTOCOL_VERSION, sellerAgentId: policy.sellerAgentId }
            : versionedError(validation.errors.join("; ")),
        );
        return;
      }

      if (request.method === "GET" && path === "/api/sellers") {
        writeJson(response, 200, { protocolVersion: PROTOCOL_VERSION, sellers: listPublicSellers() });
        return;
      }

      const pendingMatch = path.match(/^\/api\/sellers\/([^/]+)\/pending$/);
      if (request.method === "GET" && pendingMatch) {
        writeJson(response, 200, getPendingForSeller(pendingMatch[1]));
        return;
      }

      if (request.method === "POST" && path === "/api/negotiate/start") {
        const body = await startNegotiation(await readJson(request));
        writeJson(response, "error" in body ? 400 : 200, body);
        return;
      }

      if (request.method === "POST" && path === "/api/negotiate/open") {
        const body = openNegotiation(await readJson(request));
        writeJson(response, "error" in body ? 400 : 200, body);
        return;
      }

      if (request.method === "POST" && path === "/api/negotiate/message") {
        const body = await applyNegotiationMessage(await readJson(request));
        writeJson(response, "error" in body ? 400 : 200, body);
        return;
      }

      const sessionMatch = path.match(/^\/api\/negotiate\/([^/]+)$/);
      if (request.method === "GET" && sessionMatch) {
        const body = getNegotiationSession(sessionMatch[1]);
        writeJson(response, "error" in body ? 404 : 200, body);
        return;
      }

      const historyMatch = path.match(/^\/api\/negotiate\/([^/]+)\/history$/);
      if (request.method === "GET" && historyMatch) {
        const body = getNegotiationHistory(historyMatch[1]);
        writeJson(response, "error" in body ? 404 : 200, body);
        return;
      }

      writeJson(response, 404, versionedError("Not found"));
    } catch (error) {
      writeJson(response, 400, versionedError(error instanceof Error ? error.message : "Bad request"));
    }
  });
}

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        resolve(`http://127.0.0.1:${address.port}`);
      }
    });
  });
}

describe("negotiation protocol HTTP API", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    clearNegotiationsForTests();
    clearSellerRegistryForTests();
    registerSellerPolicy(sampleSellerPolicy);
    server = createProtocolTestServer();
    baseUrl = await listen(server);
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("starts a negotiation through HTTP and returns versioned protocol objects", async () => {
    const response = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: sampleBuyerRequest, sellerAgentId: sampleSellerPolicy.sellerAgentId }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(body.result.session.negotiationId).toBeTruthy();
    expect(body.result.session.messageHistory[0].messageType).toBe("Offer");
    expect(body.explanations[0].protocolMessage.messageType).toBe("Offer");
    expect(body.market.marketAverage).toBe(72);
    expect(body.market.savingsAfterNegotiation).toBeGreaterThan(0);
    expect(body.result.agreement.payload.policyExplanation.constraintsApplied.length).toBeGreaterThan(0);
  });

  it("rejects starting a negotiation against an unregistered seller", async () => {
    const response = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: sampleBuyerRequest, sellerAgentId: "seller-nobody-registered" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("not registered");
  });

  it("never requires the seller's policy in a buyer-facing request, and discovery listings carry no price fields", async () => {
    const sellersResponse = await fetch(`${baseUrl}/api/sellers`);
    const sellersBody = await sellersResponse.json();
    const serializedDiscovery = JSON.stringify(sellersBody);

    expect(serializedDiscovery).not.toContain("minimumPrice");
    expect(serializedDiscovery).not.toContain("preferredPrice");
    expect(serializedDiscovery).not.toContain(String(sampleSellerPolicy.minimumPrice));

    // Starting a negotiation only ever requires a sellerAgentId reference — never the policy itself.
    const startRequestBody = { request: sampleBuyerRequest, sellerAgentId: sampleSellerPolicy.sellerAgentId };
    expect(startRequestBody).not.toHaveProperty("policy");
    expect(JSON.stringify(startRequestBody)).not.toContain("minimumPrice");

    const startResponse = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(startRequestBody),
    });

    expect(startResponse.status).toBe(200);
  });

  it("reads a negotiation and its history through HTTP", async () => {
    const startResponse = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: sampleBuyerRequest, sellerAgentId: sampleSellerPolicy.sellerAgentId }),
    });
    const started = await startResponse.json();
    const negotiationId = started.result.session.negotiationId;

    const sessionResponse = await fetch(`${baseUrl}/api/negotiate/${negotiationId}`);
    const historyResponse = await fetch(`${baseUrl}/api/negotiate/${negotiationId}/history`);
    const sessionBody = await sessionResponse.json();
    const historyBody = await historyResponse.json();

    expect(sessionBody.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(sessionBody.session.negotiationId).toBe(negotiationId);
    expect(historyBody.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(historyBody.messageHistory.length).toBeGreaterThan(0);
  });

  it("rejects invalid protocol transitions through HTTP", async () => {
    const startResponse = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: sampleBuyerRequest, sellerAgentId: sampleSellerPolicy.sellerAgentId }),
    });
    const started = await startResponse.json();
    const negotiationId = started.result.session.negotiationId;
    const finalMessage = started.result.session.messageHistory.at(-1);

    const response = await fetch(`${baseUrl}/api/negotiate/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ negotiationId, message: finalMessage }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(body.error).toContain("terminal sessions");
  });

  it("lets buyer and seller agents negotiate entirely through the public API", async () => {
    const parley = new HttpParleyApiClient(baseUrl);
    const buyer = new BuyerAgent(sampleBuyerRequest.buyerAgentId, sampleBuyerRequest, parley);
    const seller = new SellerAgent(sampleSellerPolicy.sellerAgentId, sampleSellerPolicy, parley);
    const observer = new ObserverAgent("observer-test", parley);

    await seller.register();
    const negotiation = await buyer.negotiateWith(seller.identity.agentId);
    const negotiationId = negotiation.result.session.negotiationId;
    const summary = await observer.summarize(negotiationId);

    expect(negotiation.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(negotiation.result.session.currentState).toBe("agreement");
    expect(negotiation.result.agreement?.messageType).toBe("Agreement");
    expect(summary.negotiationId).toBe(negotiationId);
    expect(summary.messageTypes).toContain("Offer");
    expect(summary.messageTypes).toContain("Agreement");
    expect(summary.finalState).toBe("agreement");
  });

  it("resolves a turn-by-turn negotiation driven by two independent callers via open + message, every move signed and verified", async () => {
    // Each side generates its own keypair and never shares the private half —
    // exactly like run-buyer-agent.ts/run-seller-agent.ts. The server only
    // ever sees public keys (declared here) and signatures (verified there).
    const buyerKeys = generateAgentKeyPair();
    const sellerKeys = generateAgentKeyPair();
    const buyerRequest = { ...sampleBuyerRequest, buyerPublicKey: buyerKeys.publicKey };
    const sellerPolicy = { ...sampleSellerPolicy, publicKey: sellerKeys.publicKey };
    registerSellerPolicy(sellerPolicy);

    const negotiationId = crypto.randomUUID();
    const openingOffer = createOpeningOffer(buyerRequest, negotiationId, sellerPolicy.sellerAgentId, buyerKeys.privateKey);

    const opened = await (
      await fetch(`${baseUrl}/api/negotiate/open`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: buyerRequest, sellerAgentId: sellerPolicy.sellerAgentId, openingOffer }),
      })
    ).json();
    expect(opened.session.negotiationId).toBe(negotiationId);
    expect(opened.session.currentState).toBe("awaiting_seller_response");

    // Neither side is ever driven by runNegotiation()/a single function playing both parts —
    // each call below independently decides its own move using only its own private data.
    for (let i = 0; i < 10; i++) {
      const sessionResponse = await fetch(`${baseUrl}/api/negotiate/${negotiationId}`);
      const { session, commerce }: { session: NegotiationSession; commerce?: { order: { status: string } } } =
        await sessionResponse.json();

      if (session.currentState === "agreement") {
        expect(commerce?.order.status).toBe("SETTLED");
        return;
      }
      if (session.currentState === "no_deal") {
        throw new Error("negotiation ended in no_deal; test scenario expected agreement");
      }

      const lastOffer = [...session.messageHistory]
        .reverse()
        .find((m): m is OfferMessage => m.messageType === "Offer" || m.messageType === "CounterOffer")!;

      if (session.currentState === "awaiting_seller_response") {
        const move = decideSellerMove(sellerPolicy, session, lastOffer, sellerKeys.privateKey);
        const message =
          move.type === "accept"
            ? buildAcceptMessage(sellerPolicy.sellerAgentId, session.buyerAgentId, negotiationId, lastOffer.id, move.reason, sellerKeys.privateKey)
            : move.type === "counter"
              ? move.message
              : buildNoDealMessage(sellerPolicy.sellerAgentId, session.buyerAgentId, session, move.reason, sellerKeys.privateKey);
        await fetch(`${baseUrl}/api/negotiate/message`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ negotiationId, message }),
        });
        continue;
      }

      const move = decideBuyerMove(buyerRequest, session, lastOffer, buyerKeys.privateKey);
      const message =
        move.type === "accept"
          ? buildAcceptMessage(buyerRequest.buyerAgentId, session.sellerAgentId, negotiationId, lastOffer.id, move.reason, buyerKeys.privateKey)
          : move.type === "counter"
            ? move.message
            : buildNoDealMessage(buyerRequest.buyerAgentId, session.sellerAgentId, session, move.reason, buyerKeys.privateKey);
      await fetch(`${baseUrl}/api/negotiate/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ negotiationId, message }),
      });
    }

    throw new Error("negotiation did not resolve within 10 turns");
  });

  it("rejects a message whose signature does not match the claimed sender's declared public key", async () => {
    const buyerKeys = generateAgentKeyPair();
    const impostorKeys = generateAgentKeyPair();
    const buyerRequest = { ...sampleBuyerRequest, buyerPublicKey: buyerKeys.publicKey };
    const negotiationId = crypto.randomUUID();

    // Signed with the wrong key — an impostor claiming to be this buyer.
    const forgedOpeningOffer = createOpeningOffer(buyerRequest, negotiationId, sampleSellerPolicy.sellerAgentId, impostorKeys.privateKey);

    const response = await fetch(`${baseUrl}/api/negotiate/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: buyerRequest, sellerAgentId: sampleSellerPolicy.sellerAgentId, openingOffer: forgedOpeningOffer }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("signature");
  });
});

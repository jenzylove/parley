import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { sampleBuyerRequest } from "../agents/buyer/sample-buyer";
import { sampleSellerPolicy } from "../agents/seller/sample-seller";
import { BuyerAgent } from "../agents/a2a/buyer-agent";
import { HttpParleyApiClient } from "../agents/a2a/parley-api-client";
import { ObserverAgent } from "../agents/a2a/observer-agent";
import { SellerAgent } from "../agents/a2a/seller-agent";
import {
  applyNegotiationMessage,
  getNegotiationHistory,
  getNegotiationSession,
  startNegotiation,
  versionedError,
} from "./negotiate-service";
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
      if (request.method === "POST" && path === "/api/negotiate/start") {
        writeJson(response, 200, await startNegotiation(await readJson(request)));
        return;
      }

      if (request.method === "POST" && path === "/api/negotiate/message") {
        const body = applyNegotiationMessage(await readJson(request));
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
      body: JSON.stringify({ request: sampleBuyerRequest, policy: sampleSellerPolicy }),
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

  it("reads a negotiation and its history through HTTP", async () => {
    const startResponse = await fetch(`${baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: sampleBuyerRequest, policy: sampleSellerPolicy }),
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
      body: JSON.stringify({ request: sampleBuyerRequest, policy: sampleSellerPolicy }),
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
    const seller = new SellerAgent(sampleSellerPolicy.sellerAgentId, sampleSellerPolicy);
    const observer = new ObserverAgent("observer-test", parley);

    const negotiation = await buyer.negotiateWith(seller.publishPolicy());
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
});

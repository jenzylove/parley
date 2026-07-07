// Standalone CAP provider listener. This is the piece that was missing:
// Parley's "Negotiation as a Service" listing on the CROO Agent Store had
// no code answering an inbound hire — a real requester (a judge, another
// team's agent) clicking "Hire" would get silence. This process fixes that.
//
// It connects to CAP as the provider, listens for NegotiationCreated events
// against our own serviceId, and for each one: runs a REAL multi-round,
// signed Parley negotiation (using the same deterministic engine and
// signing primitives as the rest of this repo, not a stub), accepts the CAP
// negotiation, waits for the external requester to pay, and delivers the
// signed agreement as the CAP deliverable. Every completed hire is a real
// external counterparty and a real completed CAP order.
//
// Run with: npm run agent:cap-provider
//
// Env (reuses the same vars as the outbound CAP settlement adapter):
//   CROO_API_URL, CROO_WS_URL, CROO_PROVIDER_SDK_KEY, CROO_SERVICE_ID,
//   CROO_PROVIDER_WALLET_ADDRESS

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { AgentClient, DeliverableType, EventType, type Negotiation, type Order } from "@croo-network/sdk";
import { runNegotiation } from "../../core/parley-core/negotiation/engine";
import { generateAgentKeyPair } from "../../core/parley-core/negotiation/signing";
import type { SellerPolicy, ServiceRequest } from "../../core/parley-core/negotiation/types";

// tsx (unlike `next dev`) doesn't auto-load .env — load it ourselves so this
// script is runnable the same way as the other standalone agents
// (`tsx src/agents/...`) without needing a separate env-loading flag.
function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}

loadDotEnv(new URL("../../../.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const requiredEnv = ["CROO_API_URL", "CROO_PROVIDER_SDK_KEY", "CROO_SERVICE_ID", "CROO_PROVIDER_WALLET_ADDRESS"] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`[cap-provider] missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const config = { baseURL: process.env.CROO_API_URL!, wsURL: process.env.CROO_WS_URL };
const provider = new AgentClient(config, process.env.CROO_PROVIDER_SDK_KEY!);
const serviceId = process.env.CROO_SERVICE_ID!;
const providerWalletAddress = process.env.CROO_PROVIDER_WALLET_ADDRESS!;

// A distinct identity from both the real-settlement demo seller
// (sample-seller.ts, tiny prices to fit a real wallet) and the free mock
// theater (scenarios.ts) — this is the reference seller every external hire
// gets negotiated against. Prices are realistic demo numbers; they never
// move real funds themselves (the CAP-level price is whatever the hirer
// already declared as fundAmount — this policy only shapes the *negotiated
// terms inside the delivered agreement*, which is the product being sold).
const sellerKeys = generateAgentKeyPair();
const platformKeys = generateAgentKeyPair();

const hireSellerPolicy: SellerPolicy = {
  sellerAgentId: "seller-agent-parley-hire",
  publicKey: sellerKeys.publicKey,
  service: "Launch landing page copy",
  currency: "USDC",
  minimumPrice: 44,
  preferredPrice: 64,
  standardDeliveryDays: 5,
  rushFee: 8,
  bundleDiscount: 10,
  recurringClientDiscount: 4,
  maximumWorkload: 6,
  currentWorkload: 3,
  preferredPaymentSchedule: "upfront",
  maxRounds: 3,
};

/**
 * A hirer may optionally describe what to negotiate via the CAP
 * negotiation's `requirements` string (JSON). Anything missing or invalid
 * falls back to a default that reliably reaches agreement on the buyer's
 * very first offer against hireSellerPolicy — so a bare hire with no
 * requirements at all still completes end-to-end.
 */
function parseRequirements(raw: string, requesterAgentId: string, buyerPublicKey: string): ServiceRequest {
  const defaults: ServiceRequest = {
    id: `request_hire_${randomUUID().slice(0, 8)}`,
    buyerAgentId: requesterAgentId,
    buyerPublicKey,
    service: hireSellerPolicy.service,
    requestedItems: ["headline set"],
    targetPrice: 46,
    maxPrice: 62,
    currency: "USDC",
    desiredDeliveryDays: 5,
    recurringClient: false,
  };

  if (!raw) return defaults;

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceRequest>;
    const targetPrice = typeof parsed.targetPrice === "number" && parsed.targetPrice > 0 ? parsed.targetPrice : defaults.targetPrice;

    return {
      ...defaults,
      service: typeof parsed.service === "string" && parsed.service.trim() ? parsed.service : defaults.service,
      requestedItems:
        Array.isArray(parsed.requestedItems) && parsed.requestedItems.length > 0 ? parsed.requestedItems : defaults.requestedItems,
      targetPrice,
      maxPrice: typeof parsed.maxPrice === "number" && parsed.maxPrice >= targetPrice ? parsed.maxPrice : Math.max(defaults.maxPrice, targetPrice),
      desiredDeliveryDays:
        typeof parsed.desiredDeliveryDays === "number" && parsed.desiredDeliveryDays >= 1 ? parsed.desiredDeliveryDays : defaults.desiredDeliveryDays,
      recurringClient: typeof parsed.recurringClient === "boolean" ? parsed.recurringClient : defaults.recurringClient,
    };
  } catch {
    return defaults;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOrderStatus(orderId: string, status: string, maxAttempts: number, delayMs: number): Promise<Order> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const order = await provider.getOrder(orderId);

    if (order.status === status) return order;
    if (order.status === "expired" || order.status === "rejected" || order.status.endsWith("_failed")) {
      throw new Error(`order ${orderId} reached terminal status "${order.status}" while waiting for "${status}"`);
    }

    await sleep(delayMs);
  }

  throw new Error(`timed out waiting for order ${orderId} to reach "${status}"`);
}

async function handleNegotiation(negotiationId: string): Promise<void> {
  let negotiation: Negotiation;

  try {
    negotiation = await provider.getNegotiation(negotiationId);
  } catch (error) {
    console.error(`[cap-provider] could not fetch negotiation ${negotiationId}:`, error instanceof Error ? error.message : error);
    return;
  }

  if (negotiation.serviceId !== serviceId) return; // not addressed to our listing
  if (negotiation.status !== "pending") return; // already handled (e.g. backlog + live event overlap)

  console.log(
    `[cap-provider] inbound hire: negotiationId=${negotiationId} requester=${negotiation.requesterAgentId} fundAmount=${negotiation.fundAmount} fundToken=${negotiation.fundToken}`,
  );

  try {
    if (!negotiation.fundAmount || BigInt(negotiation.fundAmount) <= BigInt(0)) {
      await provider.rejectNegotiation(negotiationId, "This service requires fund-transfer pricing with a nonzero fundAmount.");
      console.log(`[cap-provider] rejected ${negotiationId}: no fundAmount declared`);
      return;
    }

    const buyerKeys = generateAgentKeyPair();
    const request = parseRequirements(negotiation.requirements, negotiation.requesterAgentId, buyerKeys.publicKey);
    const result = runNegotiation(request, hireSellerPolicy, platformKeys);

    if (!result.agreement) {
      await provider.rejectNegotiation(negotiationId, `Parley negotiation ended in NO_DEAL: ${result.noDeal?.payload.reason ?? "unknown reason"}`);
      console.log(`[cap-provider] rejected ${negotiationId}: negotiation ended NO_DEAL`);
      return;
    }

    console.log(
      `[cap-provider] negotiated a real agreement for ${negotiationId}: ${result.agreement.payload.finalOffer.price} ${result.agreement.payload.finalOffer.currency}, ${result.agreement.payload.roundsUsed} round(s), signed + platform-attested`,
    );

    const accepted = await provider.acceptNegotiationWithFundAddress(negotiationId, providerWalletAddress);
    console.log(`[cap-provider] accepted — orderId=${accepted.order.orderId}`);

    await waitForOrderStatus(accepted.order.orderId, "created", 20, 1200);
    console.log(`[cap-provider] order ${accepted.order.orderId} confirmed on-chain, awaiting payment from requester`);

    // The external requester pays on their own schedule — wait generously (up to 10 min).
    await waitForOrderStatus(accepted.order.orderId, "paid", 300, 2000);
    console.log(`[cap-provider] order ${accepted.order.orderId} paid — delivering the negotiated agreement`);

    const delivered = await provider.deliverOrder(accepted.order.orderId, {
      deliverableType: DeliverableType.Schema,
      deliverableSchema: JSON.stringify({
        protocolVersion: "parley-negotiation/0.1",
        agreement: result.agreement,
        session: result.session,
      }),
    });

    console.log(`[cap-provider] delivered order ${accepted.order.orderId} — deliverTxHash=${delivered.txHash}`);
  } catch (error) {
    console.error(`[cap-provider] failed to handle negotiation ${negotiationId}:`, error instanceof Error ? error.message : error);
  }
}

async function catchUpOnBacklog(): Promise<void> {
  const pending = await provider.listNegotiations({ role: "provider", status: "pending" });
  const forThisService = pending.filter((n) => n.serviceId === serviceId);

  if (forThisService.length === 0) return;

  console.log(`[cap-provider] found ${forThisService.length} pending negotiation(s) from before this process started`);
  for (const negotiation of forThisService) {
    await handleNegotiation(negotiation.negotiationId);
  }
}

async function main(): Promise<void> {
  console.log(`[cap-provider] starting for service ${serviceId}...`);

  // CAP requires the provider to have an active WebSocket connection before
  // it will accept new orders addressed to it (PROVIDER_NOT_ACCEPTING_ORDERS
  // otherwise) — this must happen before backlog catch-up, not after.
  const stream = await provider.connectWebSocket();
  console.log("[cap-provider] provider online.");

  await catchUpOnBacklog();

  stream.on(EventType.NegotiationCreated, (event) => {
    if (event.service_id && event.service_id !== serviceId) return;
    if (!event.negotiation_id) return;

    void handleNegotiation(event.negotiation_id);
  });

  console.log("[cap-provider] listening for inbound hires. Ctrl+C to stop.");

  process.on("SIGINT", () => {
    stream.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[cap-provider] fatal error:", error);
  process.exit(1);
});

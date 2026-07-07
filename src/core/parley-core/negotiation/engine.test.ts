import { describe, expect, it } from "vitest";
import { applyProtocolMessage, createNegotiationSession, runNegotiation } from "./engine";
import { generateAgentKeyPair } from "./signing";
import type { ProtocolMessage, SellerPolicy, ServiceRequest } from "./types";

const buyerRequest: ServiceRequest = {
  id: "request_test",
  buyerAgentId: "buyer",
  buyerPublicKey: generateAgentKeyPair().publicKey,
  service: "Landing page copy",
  requestedItems: ["headline", "faq"],
  targetPrice: 40,
  maxPrice: 58,
  currency: "USDC",
  desiredDeliveryDays: 3,
  recurringClient: true,
};

const sellerPolicy: SellerPolicy = {
  sellerAgentId: "seller",
  publicKey: generateAgentKeyPair().publicKey,
  service: "Landing page copy",
  currency: "USDC",
  minimumPrice: 44,
  preferredPrice: 64,
  standardDeliveryDays: 5,
  rushFee: 8,
  bundleDiscount: 10,
  recurringClientDiscount: 4,
  maximumWorkload: 6,
  currentWorkload: 2,
  preferredPaymentSchedule: "upfront",
  maxRounds: 4,
};

describe("multi-round negotiation engine", () => {
  it("reaches a successful agreement with persisted protocol messages", () => {
    const result = runNegotiation(buyerRequest, sellerPolicy);

    expect(result.session.currentState).toBe("agreement");
    expect(result.agreement?.messageType).toBe("Agreement");
    expect(result.agreement?.payload.policyExplanation.constraintsApplied).toEqual(
      expect.arrayContaining([
        "Recurring client discount considered: 4 USDC",
        "Payment schedule matched: upfront",
      ]),
    );
    expect(result.session.messageHistory.map((message) => message.messageType)).toEqual([
      "Offer",
      "CounterOffer",
      "Accept",
      "Agreement",
    ]);
    expect(result.agreement?.payload.finalOffer.price).toBeLessThanOrEqual(buyerRequest.maxPrice);
  });

  it("fails when buyer constraints cannot satisfy seller policy", () => {
    const result = runNegotiation(
      { ...buyerRequest, targetPrice: 20, maxPrice: 30 },
      sellerPolicy,
    );

    expect(result.session.currentState).toBe("no_deal");
    expect(result.noDeal?.messageType).toBe("NoDeal");
    // The buyer never learns the seller's reservation price, so it can only walk
    // away once rounds run out — not by inferring the seller's floor is unreachable.
    expect(result.noDeal?.payload.reason).toContain("Maximum negotiation rounds");
  });

  it("terminates when max rounds are reached", () => {
    const result = runNegotiation(
      { ...buyerRequest, targetPrice: 20, maxPrice: 70 },
      { ...sellerPolicy, minimumPrice: 60, preferredPrice: 90, bundleDiscount: 0, maxRounds: 1 },
    );

    expect(result.session.currentState).toBe("no_deal");
    expect(result.noDeal?.payload.reason).toContain("Maximum negotiation rounds");
    expect(result.noDeal?.payload.finalRound).toBe(1);
  });

  it("rejects invalid state transitions", () => {
    const session = createNegotiationSession(buyerRequest, sellerPolicy);
    const invalidCounterOffer: ProtocolMessage = {
      id: "counter_invalid",
      sender: sellerPolicy.sellerAgentId,
      receiver: buyerRequest.buyerAgentId,
      timestamp: new Date().toISOString(),
      messageType: "CounterOffer",
      payload: {
        negotiationId: session.negotiationId,
        price: 55,
        currency: "USDC",
        deliveryDays: 5,
        bundleItems: buyerRequest.requestedItems,
        paymentSchedule: "upfront",
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        round: 1,
        recurringClient: true,
      },
    };

    const transition = applyProtocolMessage(session, invalidCounterOffer);

    expect(transition.ok).toBe(false);
    expect(transition.ok ? "" : transition.error).toContain("out of turn");
  });
});

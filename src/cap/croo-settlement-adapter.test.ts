import { describe, expect, it, vi } from "vitest";
import type {
  AcceptNegotiationResult,
  DeliverOrderRequest,
  DeliverOrderResult,
  Delivery,
  NegotiateOrderRequest,
  Negotiation,
  PayOrderResult,
} from "@croo-network/sdk";
import { createPlaceholderDeliveryProof } from "@/core/parley-core/commerce/delivery";
import { createLockedTermsFromAgreement } from "@/core/parley-core/commerce/terms";
import type { CommerceOrder } from "@/core/parley-core/commerce/types";
import type { AgreementMessage } from "@/core/parley-core";
import type { CROOAgentClient } from "./croo-agent-client";
import { CROOSettlementAdapter } from "./croo-settlement-adapter";
import { BASE_USDC_ADDRESS, usdcToBaseUnits } from "./usdc";

const agreement: AgreementMessage = {
  id: "agreement_test",
  sender: "seller-agent",
  receiver: "buyer-agent",
  timestamp: new Date().toISOString(),
  messageType: "Agreement",
  payload: {
    agreementId: "agreement_1",
    negotiationId: "negotiation_1",
    buyerAgentId: "buyer-agent",
    sellerAgentId: "seller-agent",
    service: "Landing page copy",
    finalOffer: {
      negotiationId: "negotiation_1",
      price: 68,
      currency: "USDC",
      deliveryDays: 3,
      bundleItems: ["headline", "faq"],
      paymentSchedule: "upfront",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      round: 2,
    },
    acceptedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    roundsUsed: 2,
    savings: 4,
    reason: "Offer satisfies seller policy constraints.",
    policyExplanation: {
      acceptedBecause: "test",
      constraintsApplied: [],
      finalPolicyFloor: 60,
      buyerSavingsVsSellerPreferred: 4,
    },
  },
};

const lockedTerms = createLockedTermsFromAgreement(agreement, "order_1");
const deliveryProof = createPlaceholderDeliveryProof(lockedTerms);
const order: CommerceOrder = {
  orderId: "order_1",
  negotiationId: lockedTerms.negotiationId,
  status: "SETTLING",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lifecycle: [],
  lockedTerms,
};

function fakeClient(overrides: Partial<CROOAgentClient> = {}): CROOAgentClient {
  return {
    negotiateOrder: vi.fn(),
    acceptNegotiationWithFundAddress: vi.fn(),
    payOrder: vi.fn(),
    deliverOrder: vi.fn(),
    getDelivery: vi.fn(),
    ...overrides,
  };
}

describe("CROOSettlementAdapter", () => {
  it("bridges the Parley-negotiated price onto a CAP order via fund-transfer negotiation", async () => {
    const expectedFundAmount = usdcToBaseUnits(lockedTerms.price);

    const requester = fakeClient({
      negotiateOrder: vi.fn(async (req: NegotiateOrderRequest): Promise<Negotiation> => ({
        negotiationId: "cap_negotiation_1",
        serviceId: req.serviceId,
        requesterAgentId: "requester-agent",
        providerAgentId: "provider-agent",
        requirements: req.requirements ?? "",
        status: "pending",
        rejectReason: "",
        metadata: req.metadata ?? "",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdTime: new Date().toISOString(),
        updatedTime: new Date().toISOString(),
        fundAmount: req.fundAmount,
        fundToken: req.fundToken,
      })),
      payOrder: vi.fn(async (orderId: string): Promise<PayOrderResult> => ({
        order: { orderId } as PayOrderResult["order"],
        txHash: "0xpay",
      })),
      getDelivery: vi.fn(async (): Promise<Delivery> => ({
        deliveryId: "delivery_1",
        orderId: "cap_order_1",
        providerAgentId: "provider-agent",
        deliverableType: "schema",
        deliverableSchema: "{}",
        deliverableText: "",
        contentHash: "0xhash",
        status: "accepted",
        submittedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        createdTime: new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      })),
    });

    const provider = fakeClient({
      acceptNegotiationWithFundAddress: vi.fn(
        async (negotiationId: string, providerFundAddress: string): Promise<AcceptNegotiationResult> => ({
          negotiation: {
            negotiationId,
            serviceId: "service_1",
            requesterAgentId: "requester-agent",
            providerAgentId: "provider-agent",
            requirements: "",
            status: "accepted",
            rejectReason: "",
            metadata: "",
            expiresAt: new Date().toISOString(),
            createdTime: new Date().toISOString(),
            updatedTime: new Date().toISOString(),
          },
          order: {
            orderId: "cap_order_1",
            negotiationId,
            chainOrderId: "42",
            serviceId: "service_1",
            requesterAgentId: "requester-agent",
            providerAgentId: "provider-agent",
            buyerUserId: "buyer-user",
            requesterWalletAddress: "0xrequester",
            providerWalletAddress: providerFundAddress,
            price: expectedFundAmount,
            paymentToken: BASE_USDC_ADDRESS,
            deliveryWindow: 259200,
            status: "created",
            rejectReason: "",
            createTxHash: "0xcreate",
            payTxHash: "",
            deliverTxHash: "",
            rejectTxHash: "",
            clearTxHash: "",
            slaDeadline: new Date().toISOString(),
            payDeadline: new Date().toISOString(),
            createdTime: new Date().toISOString(),
            updatedTime: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            paidAt: "",
            deliveredAt: "",
            rejectedAt: "",
            expiredAt: "",
          },
        }),
      ),
      deliverOrder: vi.fn(async (orderId: string, req: DeliverOrderRequest): Promise<DeliverOrderResult> => ({
        order: { orderId } as DeliverOrderResult["order"],
        delivery: {
          deliveryId: "delivery_1",
          orderId,
          providerAgentId: "provider-agent",
          deliverableType: req.deliverableType,
          deliverableSchema: req.deliverableSchema ?? "",
          deliverableText: req.deliverableText ?? "",
          contentHash: "0xhash",
          status: "submitted",
          submittedAt: new Date().toISOString(),
          verifiedAt: "",
          createdTime: new Date().toISOString(),
          updatedTime: new Date().toISOString(),
        },
        txHash: "0xdeliver",
      })),
    });

    const adapter = new CROOSettlementAdapter(requester, provider, {
      serviceId: "service_1",
      providerWalletAddress: "0xprovider",
      usdcTokenAddress: BASE_USDC_ADDRESS,
    });

    const outcome = await adapter.settle({ order, lockedTerms, deliveryProof });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("expected settlement to succeed");
    expect(outcome.settlement.chain?.chainOrderId).toBe("42");
    expect(outcome.settlement.chain?.createTxHash).toBe("0xcreate");
    expect(outcome.settlement.chain?.payTxHash).toBe("0xpay");
    expect(outcome.settlement.chain?.deliverTxHash).toBe("0xdeliver");
    expect(requester.negotiateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ fundAmount: expectedFundAmount, fundToken: BASE_USDC_ADDRESS }),
    );
    expect(provider.acceptNegotiationWithFundAddress).toHaveBeenCalledWith("cap_negotiation_1", "0xprovider");
  });

  it("refuses to settle when CAP echoes back a fund amount that does not match Parley's locked terms", async () => {
    const requester = fakeClient({
      negotiateOrder: vi.fn(
        async (req: NegotiateOrderRequest): Promise<Negotiation> => ({
          negotiationId: "cap_negotiation_2",
          serviceId: req.serviceId,
          requesterAgentId: "requester-agent",
          providerAgentId: "provider-agent",
          requirements: req.requirements ?? "",
          status: "pending",
          rejectReason: "",
          metadata: "",
          expiresAt: new Date().toISOString(),
          createdTime: new Date().toISOString(),
          updatedTime: new Date().toISOString(),
          fundAmount: "1", // tampered / mismatched amount
          fundToken: req.fundToken,
        }),
      ),
    });
    const provider = fakeClient();

    const adapter = new CROOSettlementAdapter(requester, provider, {
      serviceId: "service_1",
      providerWalletAddress: "0xprovider",
      usdcTokenAddress: BASE_USDC_ADDRESS,
    });

    const outcome = await adapter.settle({ order, lockedTerms, deliveryProof });

    expect(outcome.ok).toBe(false);
    expect(outcome.settlement.reason).toContain("does not match Parley's locked terms");
    expect(provider.acceptNegotiationWithFundAddress).not.toHaveBeenCalled();
  });
});

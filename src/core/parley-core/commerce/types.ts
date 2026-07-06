import type { Currency, NegotiationResult } from "../negotiation/types";

export type OrderStatus =
  | "POSTED"
  | "NEGOTIATING"
  | "LOCKED"
  | "DELIVERING"
  | "DELIVERED"
  | "SETTLING"
  | "SETTLED"
  | "FAILED";

export type LockedTerms = Readonly<{
  lockedTermsId: string;
  orderId: string;
  negotiationId: string;
  agreementId: string;
  buyerAgentId: string;
  sellerAgentId: string;
  service: string;
  currency: Currency;
  price: number;
  deliveryDays: number;
  bundleItems: readonly string[];
  paymentSchedule: "upfront";
  lockedAt: string;
  expiresAt: string;
}>;

export type DeliveryProof = Readonly<{
  proofId: string;
  orderId: string;
  proofType: "placeholder";
  submittedAt: string;
  artifactHash: string;
  note: string;
}>;

export type CommerceLifecycleEvent = Readonly<{
  status: OrderStatus;
  at: string;
  note: string;
}>;

export type SettlementRecord = Readonly<{
  settlementId: string;
  adapter: string;
  status: "SETTLED" | "FAILED";
  settledAt: string;
  reference?: string;
  reason?: string;
  /** CAP on-chain evidence, populated only by the real CROOSettlementAdapter. */
  chain?: Readonly<{
    negotiationId: string;
    chainOrderId: string;
    createTxHash: string;
    payTxHash: string;
    deliverTxHash: string;
  }>;
}>;

export type CommerceOrder = Readonly<{
  orderId: string;
  negotiationId: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  lifecycle: readonly CommerceLifecycleEvent[];
  lockedTerms?: LockedTerms;
  deliveryProof?: DeliveryProof;
  settlement?: SettlementRecord;
  failureReason?: string;
}>;

export type CommerceResult = {
  order: CommerceOrder;
};

export type CommerceSeed = {
  negotiationResult: NegotiationResult;
  lockedTerms?: LockedTerms;
  deliveryProof?: DeliveryProof;
};

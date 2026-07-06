import type { OfferPayload, SellerPolicy, ServiceRequest, ValidationResult } from "./types";

const isFutureIsoDate = (value: string): boolean => {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
};

export function validateServiceRequest(request: ServiceRequest): ValidationResult {
  const errors: string[] = [];

  if (!request.id) errors.push("request.id is required");
  if (!request.buyerAgentId) errors.push("buyerAgentId is required");
  if (!request.service) errors.push("service is required");
  if (request.currency !== "USDC") errors.push("currency must be USDC");
  if (request.targetPrice <= 0) errors.push("targetPrice must be positive");
  if (request.maxPrice < request.targetPrice) errors.push("maxPrice must be >= targetPrice");
  if (request.desiredDeliveryDays < 1) errors.push("desiredDeliveryDays must be at least 1");
  if (request.requestedItems.length === 0) errors.push("requestedItems cannot be empty");
  if (typeof request.recurringClient !== "boolean") errors.push("recurringClient must be boolean");

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateSellerPolicy(policy: SellerPolicy): ValidationResult {
  const errors: string[] = [];

  if (!policy.sellerAgentId) errors.push("sellerAgentId is required");
  if (!policy.service) errors.push("service is required");
  if (policy.currency !== "USDC") errors.push("currency must be USDC");
  if (policy.minimumPrice <= 0) errors.push("minimumPrice must be positive");
  if (policy.preferredPrice < policy.minimumPrice) errors.push("preferredPrice must be >= minimumPrice");
  if (policy.standardDeliveryDays < 1) errors.push("standardDeliveryDays must be at least 1");
  if (policy.rushFee < 0) errors.push("rushFee cannot be negative");
  if (policy.bundleDiscount < 0) errors.push("bundleDiscount cannot be negative");
  if (policy.recurringClientDiscount < 0) errors.push("recurringClientDiscount cannot be negative");
  if (policy.maximumWorkload < 1) errors.push("maximumWorkload must be at least 1");
  if (policy.currentWorkload < 0) errors.push("currentWorkload cannot be negative");
  if (policy.currentWorkload > policy.maximumWorkload) errors.push("currentWorkload cannot exceed maximumWorkload");
  if (policy.preferredPaymentSchedule !== "upfront") errors.push("preferredPaymentSchedule must be upfront");
  if (policy.maxRounds < 1) errors.push("maxRounds must be at least 1");

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateOfferPayload(payload: OfferPayload): ValidationResult {
  const errors: string[] = [];

  if (!payload.negotiationId) errors.push("negotiationId is required");
  if (payload.price <= 0) errors.push("price must be positive");
  if (payload.currency !== "USDC") errors.push("currency must be USDC");
  if (payload.deliveryDays < 1) errors.push("deliveryDays must be at least 1");
  if (payload.bundleItems.length === 0) errors.push("bundleItems cannot be empty");
  if (payload.paymentSchedule !== "upfront") errors.push("paymentSchedule must be upfront");
  if (!isFutureIsoDate(payload.expiresAt)) errors.push("expiresAt must be in the future");
  if (payload.round < 1) errors.push("round must be at least 1");

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function sellerMinimumAcceptablePrice(
  payload: OfferPayload,
  policy: SellerPolicy,
  recurringClient = false,
): number {
  const rushPrice = payload.deliveryDays < policy.standardDeliveryDays ? policy.rushFee : 0;
  const discount = payload.bundleItems.length > 1 ? policy.bundleDiscount : 0;
  const recurringDiscount = recurringClient ? policy.recurringClientDiscount : 0;

  return Math.max(policy.minimumPrice, policy.minimumPrice + rushPrice - discount - recurringDiscount);
}

export function validateOfferAgainstPolicy(
  payload: OfferPayload,
  policy: SellerPolicy,
  recurringClient = false,
): ValidationResult {
  const errors: string[] = [];
  const minimumAcceptablePrice = sellerMinimumAcceptablePrice(payload, policy, recurringClient);

  if (payload.currency !== policy.currency) errors.push("offer currency does not match seller policy");
  if (payload.paymentSchedule !== policy.preferredPaymentSchedule) {
    errors.push("offer payment schedule does not match seller policy");
  }
  if (policy.currentWorkload >= policy.maximumWorkload) {
    errors.push("seller maximum workload has been reached");
  }
  if (payload.price < minimumAcceptablePrice) {
    errors.push(`price below minimum acceptable policy price (${minimumAcceptablePrice} ${policy.currency})`);
  }
  if (payload.round > policy.maxRounds) errors.push("offer exceeds max negotiation rounds");

  return errors.length ? { ok: false, errors } : { ok: true };
}

import type { AgreementMessage } from "../negotiation/types";
import type { LockedTerms } from "./types";

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();

export function createLockedTermsFromAgreement(agreement: AgreementMessage, orderId: string): LockedTerms {
  return Object.freeze({
    lockedTermsId: id("locked"),
    orderId,
    negotiationId: agreement.payload.negotiationId,
    agreementId: agreement.payload.agreementId,
    buyerAgentId: agreement.payload.buyerAgentId,
    sellerAgentId: agreement.payload.sellerAgentId,
    service: agreement.payload.service,
    currency: agreement.payload.finalOffer.currency,
    price: agreement.payload.finalOffer.price,
    deliveryDays: agreement.payload.finalOffer.deliveryDays,
    bundleItems: Object.freeze([...agreement.payload.finalOffer.bundleItems]),
    paymentSchedule: agreement.payload.finalOffer.paymentSchedule,
    lockedAt: nowIso(),
    expiresAt: agreement.payload.expiresAt,
  });
}

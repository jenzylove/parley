import type { DeliveryProof, LockedTerms } from "./types";

const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const nowIso = () => new Date().toISOString();

export function createPlaceholderDeliveryProof(lockedTerms: LockedTerms): DeliveryProof {
  return Object.freeze({
    proofId: id("proof"),
    orderId: lockedTerms.orderId,
    proofType: "placeholder",
    submittedAt: nowIso(),
    artifactHash: "placeholder-proof-hash",
    note: "Placeholder proof attached before settlement. Replace with real CROO delivery proof when available.",
  });
}

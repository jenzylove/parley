import { toPublicSellerTerms, validateSellerPolicy } from "@/core/parley-core";
import type { PublicSellerTerms, SellerPolicy, ValidationResult } from "@/core/parley-core";
import { getGlobalSingleton } from "./global-singleton";

const sellers = getGlobalSingleton("sellers", () => new Map<string, SellerPolicy>());

export function registerSellerPolicy(policy: SellerPolicy): ValidationResult {
  const validation = validateSellerPolicy(policy);

  if (!validation.ok) {
    return validation;
  }

  sellers.set(policy.sellerAgentId, policy);
  return { ok: true };
}

export function getSellerPolicy(sellerAgentId: string): SellerPolicy | undefined {
  return sellers.get(sellerAgentId);
}

export function listPublicSellers(): PublicSellerTerms[] {
  return Array.from(sellers.values()).map(toPublicSellerTerms);
}

export function clearSellerRegistryForTests(): void {
  sellers.clear();
}

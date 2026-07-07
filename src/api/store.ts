import type { CommerceOrder, MarketIntelligence, NegotiationResult, NegotiationSession, ServiceRequest } from "@/core/parley-core";
import { getGlobalSingleton } from "./global-singleton";

type StoredNegotiation = {
  result: NegotiationResult;
  session: NegotiationSession;
  request: ServiceRequest;
  commerce?: {
    order: CommerceOrder;
  };
  market?: MarketIntelligence;
};

const negotiations = getGlobalSingleton("negotiations", () => new Map<string, StoredNegotiation>());

export function saveNegotiation(
  result: NegotiationResult,
  request: ServiceRequest,
  commerce?: { order: CommerceOrder },
  market?: MarketIntelligence,
): NegotiationSession {
  negotiations.set(result.session.negotiationId, {
    result,
    session: result.session,
    request,
    commerce,
    market,
  });

  return result.session;
}

export function getNegotiation(negotiationId: string): StoredNegotiation | undefined {
  return negotiations.get(negotiationId);
}

export function updateNegotiationSession(
  negotiationId: string,
  session: NegotiationSession,
  commerce?: { order: CommerceOrder },
  market?: MarketIntelligence,
): NegotiationSession {
  const existing = negotiations.get(negotiationId);

  if (!existing) {
    throw new Error("Negotiation not found");
  }

  negotiations.set(negotiationId, {
    ...existing,
    session,
    result: {
      ...existing.result,
      session,
    },
    commerce: commerce ?? existing.commerce,
    market: market ?? existing.market,
  });

  return session;
}

/** Negotiation IDs where the given seller has a move to make right now. Lets a standalone seller process discover its own pending work without an out-of-band negotiationId. */
export function listPendingForSeller(sellerAgentId: string): string[] {
  return Array.from(negotiations.values())
    .filter((entry) => entry.session.sellerAgentId === sellerAgentId && entry.session.currentState === "awaiting_seller_response")
    .map((entry) => entry.session.negotiationId);
}

/** Read-only enumeration for dashboard/summary views. No auth/ownership scoping exists yet — this is every negotiation this server process has handled, newest first. */
export function listAllNegotiations(): StoredNegotiation[] {
  return Array.from(negotiations.values()).sort(
    (a, b) => new Date(b.session.createdAt).getTime() - new Date(a.session.createdAt).getTime(),
  );
}

export function clearNegotiationsForTests() {
  negotiations.clear();
}

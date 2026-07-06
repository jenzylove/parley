import type { CommerceOrder, MarketIntelligence, NegotiationResult, NegotiationSession } from "@/core/parley-core";

type StoredNegotiation = {
  result: NegotiationResult;
  session: NegotiationSession;
  commerce?: {
    order: CommerceOrder;
  };
  market?: MarketIntelligence;
};

const negotiations = new Map<string, StoredNegotiation>();

export function saveNegotiation(
  result: NegotiationResult,
  commerce?: { order: CommerceOrder },
  market?: MarketIntelligence,
): NegotiationSession {
  negotiations.set(result.session.negotiationId, {
    result,
    session: result.session,
    commerce,
    market,
  });

  return result.session;
}

export function getNegotiation(negotiationId: string): StoredNegotiation | undefined {
  return negotiations.get(negotiationId);
}

export function updateNegotiationSession(negotiationId: string, session: NegotiationSession): NegotiationSession {
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
  });

  return session;
}

export function clearNegotiationsForTests() {
  negotiations.clear();
}

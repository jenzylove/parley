import type { NegotiationResult } from "@/core/parley-core";
import type { CommerceOrder, CommerceSeed, CommerceLifecycleEvent, LockedTerms } from "@/core/parley-core/commerce/types";
import { createLockedTermsFromAgreement } from "@/core/parley-core/commerce/terms";
import { createPlaceholderDeliveryProof } from "@/core/parley-core/commerce/delivery";
import type { SettlementAdapter } from "./types";

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

function createEvent(status: CommerceLifecycleEvent["status"], note: string): CommerceLifecycleEvent {
  return Object.freeze({ status, at: nowIso(), note });
}

function createPostedOrder(negotiationResult: NegotiationResult): CommerceOrder {
  const createdAt = nowIso();

  return Object.freeze({
    orderId: id("order"),
    negotiationId: negotiationResult.session.negotiationId,
    status: "POSTED",
    createdAt,
    updatedAt: createdAt,
    lifecycle: [createEvent("POSTED", "Order posted from buyer request.")],
  });
}

function withOrderPatch(order: CommerceOrder, patch: Partial<CommerceOrder>, event: CommerceLifecycleEvent): CommerceOrder {
  return Object.freeze({
    ...order,
    ...patch,
    updatedAt: event.at,
    lifecycle: [...order.lifecycle, event],
  });
}

export async function buildCommerceOrder(seed: CommerceSeed, adapter: SettlementAdapter): Promise<CommerceOrder> {
  let order = createPostedOrder(seed.negotiationResult);
  order = withOrderPatch(order, { status: "NEGOTIATING" }, createEvent("NEGOTIATING", "Negotiation in progress."));

  const result = seed.negotiationResult;
  const agreement = result.agreement;

  if (!agreement) {
    const failureReason = result.noDeal?.payload.reason ?? "Negotiation did not produce locked terms.";

    return withOrderPatch(
      order,
      {
        status: "FAILED",
        failureReason,
      },
      createEvent("FAILED", failureReason),
    );
  }

  const lockedTerms: LockedTerms = seed.lockedTerms ?? createLockedTermsFromAgreement(agreement, order.orderId);
  order = withOrderPatch(order, { status: "LOCKED", lockedTerms }, createEvent("LOCKED", "Negotiation produced immutable locked terms."));

  const deliveryProof = seed.deliveryProof ?? createPlaceholderDeliveryProof(lockedTerms);
  order = withOrderPatch(
    order,
    { status: "DELIVERING", deliveryProof },
    createEvent("DELIVERING", "Placeholder delivery proof attached."),
  );

  order = withOrderPatch(order, { status: "DELIVERED" }, createEvent("DELIVERED", "Delivery proof acknowledged."));
  order = withOrderPatch(order, { status: "SETTLING" }, createEvent("SETTLING", "Settlement adapter invoked."));

  const settlement = await adapter.settle({
    order,
    lockedTerms,
    deliveryProof,
  });

  if (settlement.ok) {
    return withOrderPatch(
      order,
      { status: "SETTLED", settlement: settlement.settlement },
      createEvent("SETTLED", `Order settled via ${settlement.settlement.adapter}.`),
    );
  }

  return withOrderPatch(
    order,
    {
      status: "FAILED",
      settlement: settlement.settlement,
      failureReason: settlement.settlement.reason ?? "Settlement failed.",
    },
    createEvent("FAILED", settlement.settlement.reason ?? "Settlement failed."),
  );
}

import type { CommerceOrder, DeliveryProof, LockedTerms, SettlementRecord } from "@/core/parley-core/commerce/types";

export type SettlementRequest = {
  order: CommerceOrder;
  lockedTerms: LockedTerms;
  deliveryProof: DeliveryProof;
};

export type SettlementOutcome =
  | {
      ok: true;
      settlement: SettlementRecord;
    }
  | {
      ok: false;
      settlement: SettlementRecord;
    };

export interface SettlementAdapter {
  readonly name: string;
  settle(request: SettlementRequest): Promise<SettlementOutcome>;
}

import type { SettlementAdapter, SettlementRequest, SettlementOutcome } from "./types";

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export class MockSettlementAdapter implements SettlementAdapter {
  readonly name = "mock";

  async settle(request: SettlementRequest): Promise<SettlementOutcome> {
    return {
      ok: true,
      settlement: {
        settlementId: id("settlement"),
        adapter: this.name,
        status: "SETTLED",
        settledAt: nowIso(),
        reference: `mock:${request.order.orderId}`,
      },
    };
  }
}

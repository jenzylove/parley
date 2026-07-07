import { DeliverableType } from "@croo-network/sdk";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import type { CROOAgentClient } from "./croo-agent-client";
import type { SettlementAdapter, SettlementRequest, SettlementOutcome } from "./types";
import { sameAddress, usdcToBaseUnits } from "./usdc";

const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export type CROOSettlementConfig = {
  serviceId: string;
  providerWalletAddress: string;
  usdcTokenAddress: string;
};

/**
 * Bridges a Parley-negotiated price onto CAP settlement.
 *
 * CAP's own `negotiateOrder` charges whatever price the provider registered
 * for the service — it has no concept of a buyer/seller-negotiated price
 * unless the service is registered with `require_fund_transfer=true`. In that
 * mode the requester supplies `fundAmount`/`fundToken` at negotiation time and
 * the provider declares a receiving address at accept time. This adapter uses
 * that path to carry Parley's locked terms price onto the CAP order verbatim,
 * and refuses to settle if CAP's own negotiation record doesn't echo back the
 * exact amount Parley agreed to (protects against a tampered/racing price).
 */
export class CROOSettlementAdapter implements SettlementAdapter {
  readonly name = "croo";

  private providerOnline: Promise<void> | undefined;

  constructor(
    private readonly requester: CROOAgentClient,
    private readonly provider: CROOAgentClient,
    private readonly config: CROOSettlementConfig,
  ) {}

  /**
   * CAP appears to require a provider to have an active WebSocket connection
   * before it will accept new orders addressed to it (the quick-start docs
   * describe running the provider example so "your Agent goes online" —
   * there's no separate dashboard toggle). Best-effort and cached per adapter
   * instance: if this fails or the injected client has no `connectWebSocket`
   * (e.g. test fakes), settlement still proceeds and surfaces CAP's own error.
   */
  private ensureProviderOnline(): Promise<void> {
    if (!this.providerOnline) {
      this.providerOnline = (async () => {
        if (!this.provider.connectWebSocket) return;
        try {
          await this.provider.connectWebSocket();
        } catch {
          // Best-effort — fall through and let the actual accept call surface any real error.
        }
      })();
    }

    return this.providerOnline;
  }

  async settle(request: SettlementRequest): Promise<SettlementOutcome> {
    const { lockedTerms, deliveryProof } = request;
    const fundAmount = usdcToBaseUnits(lockedTerms.price);

    try {
      await this.ensureProviderOnline();

      const negotiation = await this.requester.negotiateOrder({
        serviceId: this.config.serviceId,
        requirements: JSON.stringify({
          negotiationId: lockedTerms.negotiationId,
          agreementId: lockedTerms.agreementId,
          service: lockedTerms.service,
          deliveryDays: lockedTerms.deliveryDays,
          bundleItems: lockedTerms.bundleItems,
        }),
        metadata: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, source: "parley" }),
        fundAmount,
        fundToken: this.config.usdcTokenAddress,
      });

      if (negotiation.fundAmount !== fundAmount || !sameAddress(negotiation.fundToken ?? "", this.config.usdcTokenAddress)) {
        return this.failure(
          `CAP negotiation echoed fundAmount=${negotiation.fundAmount} fundToken=${negotiation.fundToken}, ` +
            `which does not match Parley's locked terms (${fundAmount} ${this.config.usdcTokenAddress}). Refusing to settle a mismatched price.`,
        );
      }

      const accepted = await this.provider.acceptNegotiationWithFundAddress(
        negotiation.negotiationId,
        this.config.providerWalletAddress,
      );

      const created = await this.waitForOrderCreated(accepted.order.orderId);
      if (!created.ok) {
        return this.failure(created.reason);
      }

      const paid = await this.requester.payOrder(accepted.order.orderId);

      const confirmedPaid = await this.waitForOrderPaid(accepted.order.orderId);
      if (!confirmedPaid.ok) {
        return this.failure(confirmedPaid.reason);
      }

      const delivered = await this.provider.deliverOrder(accepted.order.orderId, {
        deliverableType: DeliverableType.Schema,
        deliverableSchema: JSON.stringify({ lockedTerms, deliveryProof }),
      });

      await this.requester.getDelivery(accepted.order.orderId);

      return {
        ok: true,
        settlement: {
          settlementId: delivered.order.orderId,
          adapter: this.name,
          status: "SETTLED",
          settledAt: nowIso(),
          reference: delivered.txHash,
          chain: {
            negotiationId: negotiation.negotiationId,
            chainOrderId: accepted.order.chainOrderId,
            createTxHash: accepted.order.createTxHash,
            payTxHash: paid.txHash,
            deliverTxHash: delivered.txHash,
          },
        },
      };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : "CAP settlement failed.");
    }
  }

  /**
   * `acceptNegotiationWithFundAddress` triggers CAP's `createOrder` on-chain
   * transaction asynchronously — the order can still be in `"creating"`
   * status immediately after accept returns. Calling `payOrder` before it
   * reaches `"created"` fails with CAP's own `INVALID_STATUS`. Poll briefly
   * for on-chain confirmation instead of assuming accept means "ready".
   */
  private async waitForOrderCreated(orderId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const maxAttempts = 20;
    const delayMs = 1200;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const order = await this.requester.getOrder(orderId);

      if (order.status === "created") {
        return { ok: true };
      }

      if (order.status === "create_failed") {
        return { ok: false, reason: `CAP order creation failed on-chain (orderId=${orderId}).` };
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return { ok: false, reason: `Timed out waiting for CAP order ${orderId} to reach "created" status.` };
  }

  /**
   * Same on-chain-confirmation gap as order creation: `payOrder` submits the
   * escrow transaction and returns a txHash immediately, but the order stays
   * in `"paying"` until it confirms. Calling `deliverOrder` before it reaches
   * `"paid"` fails with CAP's `INVALID_STATUS`.
   */
  private async waitForOrderPaid(orderId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const maxAttempts = 20;
    const delayMs = 1200;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const order = await this.requester.getOrder(orderId);

      if (order.status === "paid") {
        return { ok: true };
      }

      if (order.status === "pay_failed") {
        return { ok: false, reason: `CAP order payment failed on-chain (orderId=${orderId}).` };
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return { ok: false, reason: `Timed out waiting for CAP order ${orderId} to reach "paid" status.` };
  }

  private failure(reason: string): SettlementOutcome {
    return {
      ok: false,
      settlement: {
        settlementId: id("settlement"),
        adapter: this.name,
        status: "FAILED",
        settledAt: nowIso(),
        reason,
      },
    };
  }
}

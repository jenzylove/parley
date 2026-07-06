import { DeliverableType } from "@croo-network/sdk";
import { PROTOCOL_VERSION } from "@/api/protocol-version";
import type { CROOAgentClient } from "./croo-agent-client";
import type { SettlementAdapter, SettlementRequest, SettlementOutcome } from "./types";
import { usdcToBaseUnits } from "./usdc";

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

  constructor(
    private readonly requester: CROOAgentClient,
    private readonly provider: CROOAgentClient,
    private readonly config: CROOSettlementConfig,
  ) {}

  async settle(request: SettlementRequest): Promise<SettlementOutcome> {
    const { lockedTerms, deliveryProof } = request;
    const fundAmount = usdcToBaseUnits(lockedTerms.price);

    try {
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

      if (negotiation.fundAmount !== fundAmount || negotiation.fundToken !== this.config.usdcTokenAddress) {
        return this.failure(
          `CAP negotiation echoed fundAmount=${negotiation.fundAmount} fundToken=${negotiation.fundToken}, ` +
            `which does not match Parley's locked terms (${fundAmount} ${this.config.usdcTokenAddress}). Refusing to settle a mismatched price.`,
        );
      }

      const accepted = await this.provider.acceptNegotiationWithFundAddress(
        negotiation.negotiationId,
        this.config.providerWalletAddress,
      );

      const paid = await this.requester.payOrder(accepted.order.orderId);

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

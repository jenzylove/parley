import type { SellerPolicy } from "@/core/parley-core";
import type { AgentIdentity, ParleyApiClient } from "./types";

export class SellerAgent {
  readonly identity: AgentIdentity;

  constructor(
    agentId: string,
    private readonly policy: SellerPolicy,
    private readonly parley: ParleyApiClient,
  ) {
    this.identity = { agentId, role: "seller" };
  }

  /** Registers this seller's policy with Parley's registry. The policy itself is never sent to the buyer. */
  async register(): Promise<void> {
    await this.parley.registerSeller(this.policy);
  }

  getPolicy(): SellerPolicy {
    return this.policy;
  }
}

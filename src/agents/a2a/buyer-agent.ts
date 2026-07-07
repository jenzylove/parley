import type { ServiceRequest } from "@/core/parley-core";
import type { AgentIdentity, ParleyApiClient } from "./types";

export class BuyerAgent {
  readonly identity: AgentIdentity;

  constructor(
    agentId: string,
    private readonly request: ServiceRequest,
    private readonly parley: ParleyApiClient,
  ) {
    this.identity = { agentId, role: "buyer" };
  }

  getRequest(): ServiceRequest {
    return this.request;
  }

  /** Only ever needs the seller's public identity — never sees the seller's policy. */
  async negotiateWith(sellerAgentId: string) {
    return this.parley.startNegotiation(this.request, sellerAgentId);
  }
}

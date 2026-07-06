import type { SellerPolicy, ServiceRequest } from "@/core/parley-core";
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

  async negotiateWith(policy: SellerPolicy) {
    return this.parley.startNegotiation(this.request, policy);
  }
}

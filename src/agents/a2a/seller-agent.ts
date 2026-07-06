import type { SellerPolicy } from "@/core/parley-core";
import type { AgentIdentity } from "./types";

export class SellerAgent {
  readonly identity: AgentIdentity;

  constructor(
    agentId: string,
    private readonly policy: SellerPolicy,
  ) {
    this.identity = { agentId, role: "seller" };
  }

  publishPolicy(): SellerPolicy {
    return this.policy;
  }
}

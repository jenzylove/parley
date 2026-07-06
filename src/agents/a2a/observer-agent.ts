import type { AgentIdentity, ObserverSummary, ParleyApiClient } from "./types";

export class ObserverAgent {
  readonly identity: AgentIdentity;

  constructor(
    agentId: string,
    private readonly parley: ParleyApiClient,
  ) {
    this.identity = { agentId, role: "observer" };
  }

  async summarize(negotiationId: string): Promise<ObserverSummary> {
    const [session, history] = await Promise.all([
      this.parley.getSession(negotiationId),
      this.parley.getHistory(negotiationId),
    ]);
    const messageTypes = history.messageHistory.map((message) => message.messageType);

    return {
      observerAgentId: this.identity.agentId,
      negotiationId,
      messageCount: history.messageHistory.length,
      messageTypes,
      finalState: session.session.currentState,
      summary: `Observed ${history.messageHistory.length} protocol messages ending in ${session.session.currentState}.`,
    };
  }
}

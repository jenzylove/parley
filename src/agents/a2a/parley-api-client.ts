import type { HistoryResponse, NegotiationResponse, SessionResponse } from "@/api/types";
import type { SellerPolicy, ServiceRequest } from "@/core/parley-core";
import type { ParleyApiClient } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;

  if (!response.ok) {
    throw new Error(`Parley API request failed with status ${response.status}`);
  }

  return body;
}

export class HttpParleyApiClient implements ParleyApiClient {
  constructor(private readonly baseUrl: string) {}

  async registerSeller(policy: SellerPolicy): Promise<{ sellerAgentId: string }> {
    const response = await fetch(`${this.baseUrl}/api/sellers/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(policy),
    });

    return readJson<{ sellerAgentId: string }>(response);
  }

  async startNegotiation(request: ServiceRequest, sellerAgentId: string): Promise<NegotiationResponse> {
    const response = await fetch(`${this.baseUrl}/api/negotiate/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request, sellerAgentId }),
    });

    return readJson<NegotiationResponse>(response);
  }

  async getSession(negotiationId: string): Promise<SessionResponse> {
    return readJson<SessionResponse>(await fetch(`${this.baseUrl}/api/negotiate/${negotiationId}`));
  }

  async getHistory(negotiationId: string): Promise<HistoryResponse> {
    return readJson<HistoryResponse>(await fetch(`${this.baseUrl}/api/negotiate/${negotiationId}/history`));
  }
}

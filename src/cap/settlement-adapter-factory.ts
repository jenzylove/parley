import { AgentClient } from "@croo-network/sdk";
import { CROOSettlementAdapter } from "./croo-settlement-adapter";
import { MockSettlementAdapter } from "./mock-settlement-adapter";
import type { SettlementAdapter } from "./types";

export function createSettlementAdapter(): SettlementAdapter {
  const {
    CROO_API_URL,
    CROO_WS_URL,
    CROO_REQUESTER_SDK_KEY,
    CROO_PROVIDER_SDK_KEY,
    CROO_SERVICE_ID,
    CROO_PROVIDER_WALLET_ADDRESS,
    CROO_USDC_TOKEN_ADDRESS,
  } = process.env;

  const hasRealCredentials =
    CROO_API_URL &&
    CROO_REQUESTER_SDK_KEY &&
    CROO_PROVIDER_SDK_KEY &&
    CROO_SERVICE_ID &&
    CROO_PROVIDER_WALLET_ADDRESS &&
    CROO_USDC_TOKEN_ADDRESS;

  if (hasRealCredentials && process.env.NODE_ENV !== "test") {
    const clientConfig = { baseURL: CROO_API_URL, wsURL: CROO_WS_URL };

    return new CROOSettlementAdapter(
      new AgentClient(clientConfig, CROO_REQUESTER_SDK_KEY),
      new AgentClient(clientConfig, CROO_PROVIDER_SDK_KEY),
      {
        serviceId: CROO_SERVICE_ID,
        providerWalletAddress: CROO_PROVIDER_WALLET_ADDRESS,
        usdcTokenAddress: CROO_USDC_TOKEN_ADDRESS,
      },
    );
  }

  return new MockSettlementAdapter();
}

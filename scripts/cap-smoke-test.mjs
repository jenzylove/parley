// Minimal, dependency-free sanity check for CAP credentials/service config.
// Run with: npm run cap:smoke
//
// Calls negotiateOrder with the same shape CROOSettlementAdapter uses, and
// prints the raw APIError (httpStatus/code/reason) on failure so dashboard
// misconfiguration (wrong serviceId, require_fund_transfer off, etc.) is
// diagnosable without going through the full negotiation + UI flow.

import { AgentClient, APIError } from "@croo-network/sdk";

const required = [
  "CROO_API_URL",
  "CROO_REQUESTER_SDK_KEY",
  "CROO_SERVICE_ID",
  "CROO_USDC_TOKEN_ADDRESS",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new AgentClient(
  { baseURL: process.env.CROO_API_URL, wsURL: process.env.CROO_WS_URL },
  process.env.CROO_REQUESTER_SDK_KEY,
);

const smokeTestFundAmount = "10000"; // 0.01 USDC (6 decimals) — cheap probe, never paid.

try {
  const negotiation = await client.negotiateOrder({
    serviceId: process.env.CROO_SERVICE_ID,
    requirements: JSON.stringify({ source: "cap-smoke-test" }),
    fundAmount: smokeTestFundAmount,
    fundToken: process.env.CROO_USDC_TOKEN_ADDRESS,
  });

  console.log("OK — negotiateOrder succeeded:");
  console.log(JSON.stringify(negotiation, null, 2));
  console.log(
    "\nThis created a real pending negotiation on CAP. It will expire on its own " +
      "if nothing accepts it — no funds move until acceptNegotiationWithFundAddress + payOrder.",
  );
} catch (error) {
  if (error instanceof APIError) {
    console.error("negotiateOrder FAILED:");
    console.error(`  httpStatus: ${error.httpStatus}`);
    console.error(`  code:       ${error.code}`);
    console.error(`  reason:     ${error.reason}`);
    console.error(`  message:    ${error.message}`);
    console.error("\nCommon causes:");
    console.error('  SERVICE_NOT_FOUND        -> CROO_SERVICE_ID does not match a real service. Re-copy it from the dashboard.');
    console.error('  INVALID_PARAMS           -> the service likely has "Require Fund Transfer" turned OFF. Enable it, or drop fundAmount/fundToken for a fixed-price service.');
    console.error('  UNAUTHORIZED / FORBIDDEN -> CROO_REQUESTER_SDK_KEY is wrong, expired, or belongs to a different agent.');
  } else {
    console.error("negotiateOrder FAILED (non-API error):", error);
  }
  process.exit(1);
}

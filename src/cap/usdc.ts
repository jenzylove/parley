/** Native USDC on Base mainnet (chain id 8453). 6 decimals. */
export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const USDC_DECIMALS = 6;

/** Converts a Parley price (e.g. 68 USDC) into the base-unit decimal string CAP's fund-transfer negotiation expects. */
export function usdcToBaseUnits(price: number): string {
  return Math.round(price * 10 ** USDC_DECIMALS).toString();
}

/** Ethereum addresses are case-insensitive; mixed-case is only an optional EIP-55 checksum encoding. */
export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

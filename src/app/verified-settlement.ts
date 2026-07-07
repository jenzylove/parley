/**
 * A real Parley negotiation settled through the live CROO Agent Protocol on
 * Base mainnet during development — captured statically so this proof
 * survives server restarts (the in-memory negotiation store does not) and
 * doesn't depend on re-running a costly real settlement for every visitor.
 * All three transactions are independently verifiable on Basescan.
 */
export const verifiedSettlement = {
  negotiationId: "negotiation_vnnzat95",
  service: "Launch landing page copy",
  finalPrice: 2,
  currency: "USDC",
  roundsUsed: 1,
  policyExplanation: {
    acceptedBecause:
      "The final offer satisfied seller price floor, workload capacity, delivery timing, and payment schedule constraints.",
    constraintsApplied: [
      "Rush fee considered: 0.5 USDC",
      "Bundle discount considered: 0.5 USDC",
      "Recurring client discount considered: 0.2 USDC",
      "Payment schedule matched: upfront",
      "Final price stayed above policy floor: 1.5 USDC",
    ],
  },
  chain: {
    network: "Base Mainnet",
    chainId: 8453,
    createTxHash: "0x4287b3f589c047f6b49744dae668a81b43b11572b2fca3b8e9d1d213bd8d76df",
    payTxHash: "0x42fc44232f2b13fba829d007ca47f94256d11a696653e18ddaf3e94364e73cf8",
    deliverTxHash: "0xf8c51807a18a14a934094db9bf7d6d639e5fa36a7c2b5f0ee897c2836e439726",
  },
} as const;

export function basescanTxUrl(hash: string): string {
  return `https://basescan.org/tx/${hash}`;
}

// Pure UI labels + the scenario key type — deliberately has zero imports from
// signing.ts or anything else that touches Node's crypto. Client components
// (negotiation-theater.tsx) import from here, never from ./scenarios, so
// Next.js never has a reason to pull server-only key generation into the
// browser bundle.

export type ScenarioKey = "balanced" | "bundle-recurring" | "rush" | "no-deal";

export const scenarioLabels: Record<ScenarioKey, { title: string; description: string }> = {
  balanced: {
    title: "Balanced deal",
    description: "Single item, standard delivery. Buyer opens low; seller counters; buyer accepts.",
  },
  "bundle-recurring": {
    title: "Bundle + recurring client",
    description: "Multi-item bundle from a repeat buyer — bundle and loyalty discounts both apply.",
  },
  rush: {
    title: "Rush delivery",
    description: "Buyer wants faster-than-standard delivery — seller's rush fee applies.",
  },
  "no-deal": {
    title: "No deal",
    description: "Buyer's ceiling can't clear the seller's floor — negotiation exhausts max rounds and terminates.",
  },
};

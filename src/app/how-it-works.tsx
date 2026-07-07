"use client";

import { motion } from "framer-motion";

const steps = [
  {
    label: "Connect CROO Agent",
    description: "Link the agent identity you already registered on the CROO Agent Store.",
  },
  {
    label: "Configure Policies",
    description: "Set your price floor, rush fees, bundle discounts, and round limits — once.",
  },
  {
    label: "Receive Orders",
    description: "Buyers (or their agents) reach your agent with a service request.",
  },
  {
    label: "Automatic Negotiation",
    description: "Parley's deterministic engine counters, concedes, and decides — no manual back-and-forth.",
  },
  {
    label: "CAP Settlement",
    description: "The agreed price settles for real, on-chain, through the CROO Agent Protocol.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="howItWorks">
      <div className="howItWorksHeader">
        <p className="eyebrow">How it works</p>
        <h2>Connect once. Negotiate forever.</h2>
      </div>

      <div className="stepFlow">
        {steps.map((step, index) => (
          <motion.div
            key={step.label}
            className="stepFlowItem"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: index * 0.08, ease: "easeOut" }}
          >
            <div className="stepFlowCard">
              <span className="stepFlowNumber">{index + 1}</span>
              <strong>{step.label}</strong>
              <p>{step.description}</p>
            </div>
            {index < steps.length - 1 ? <span className="stepFlowArrow" aria-hidden>&rarr;</span> : null}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

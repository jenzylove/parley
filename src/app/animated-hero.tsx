"use client";

import { motion, type Variants } from "framer-motion";

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const orbs = [
  { className: "heroOrb heroOrb--teal", x: [0, 30, -10, 0], y: [0, -20, 10, 0], duration: 18 },
  { className: "heroOrb heroOrb--amber", x: [0, -25, 15, 0], y: [0, 25, -15, 0], duration: 22 },
  { className: "heroOrb heroOrb--navy", x: [0, 20, -20, 0], y: [0, -15, 20, 0], duration: 26 },
];

export function AnimatedHero({ finalPrice, currency }: { finalPrice: number; currency: string }) {
  return (
    <section id="top" className="animatedHero">
      <div className="heroGrid" aria-hidden />
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className={orb.className}
          animate={{ x: orb.x, y: orb.y }}
          transition={{ duration: orb.duration, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden
        />
      ))}

      <motion.div className="heroContent" variants={container} initial="hidden" animate="show">
        <motion.span className="heroBadge" variants={item}>
          <span className="heroBadgeDot" /> Live on Base mainnet
        </motion.span>

        <motion.h1 variants={item}>
          Parley makes CAP&apos;s negotiation phase <span className="heroAccent">programmable</span>.
        </motion.h1>

        <motion.p className="heroLede" variants={item}>
          CAP&apos;s own negotiation is accept/reject at a fixed price. Parley adds multi-round, policy-bounded
          bargaining in front of it — a deterministic engine decides every offer, and the agreed price settles for
          real through the CROO Agent Protocol on Base.
        </motion.p>

        <motion.p className="heroSellerNote" variants={item}>
          For sellers: close more deals through dynamic, policy-bounded pricing — not by cutting your margin.
        </motion.p>

        <motion.div className="heroCtaRow" variants={item}>
          <a className="heroCtaPrimary" href="#theater">
            Watch a negotiation
          </a>
          <a className="heroCtaSecondary" href="#proof">
            View on-chain proof
          </a>
        </motion.div>

        <motion.div className="heroStats" variants={item}>
          <div>
            <strong>
              {finalPrice} {currency}
            </strong>
            <span>settled on-chain</span>
          </div>
          <div>
            <strong>3</strong>
            <span>verified transactions</span>
          </div>
          <div>
            <strong>Ed25519</strong>
            <span>signed &amp; verified</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

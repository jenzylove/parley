"use client";

import Link from "next/link";
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

export function AnimatedHero() {
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

      <div className="heroInner">
        <motion.div className="heroContent" variants={container} initial="hidden" animate="show">
          <motion.span className="heroBadge" variants={item}>
            <span className="heroBadgeDot" /> Settles on Base via the CROO Agent Protocol
          </motion.span>

          <motion.h1 variants={item}>
            Give your CROO Agent <span className="heroAccent">the ability to negotiate</span>.
          </motion.h1>

          <motion.p className="heroLede" variants={item}>
            Connect your agent once, define your pricing rules, and Parley negotiates every order automatically:
            counteroffers, rush fees, bundle discounts, hard limits, all before it ever reaches CAP settlement.
          </motion.p>

          <motion.p className="heroSellerNote" variants={item}>
            Parley is seller-side infrastructure. Your buyers keep using the normal CAP flow, and they never install
            or configure anything.
          </motion.p>

          <motion.div className="heroCtaRow" variants={item}>
            <Link className="heroCtaPrimary" href="/start">
              Start Building
            </Link>
            <Link className="heroCtaSecondary" href="/demo">
              Live Negotiation
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

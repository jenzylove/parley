"use client";

import { motion } from "framer-motion";

const navLinks = [
  { label: "Protocol", href: "#proof" },
  { label: "Try it", href: "#theater" },
  { label: "Spec", href: "https://github.com/jenzylove/parley/blob/main/docs/SPEC.md", external: true },
];

export function SiteHeader() {
  return (
    <motion.header
      className="siteHeader"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <a className="brandMark" href="#top">
        <span className="brandGlyph">P</span>
        <span>Parley</span>
      </a>

      <nav className="siteNav">
        {navLinks.map((link) => (
          <a key={link.label} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noreferrer" : undefined}>
            {link.label}
          </a>
        ))}
      </nav>

      <a className="headerCta" href="#theater">
        Watch a negotiation
      </a>
    </motion.header>
  );
}

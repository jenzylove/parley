"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const navLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Docs", href: "https://github.com/jenzylove/parley/blob/main/docs/SPEC.md", external: true },
];

export function SiteHeader() {
  return (
    <motion.header
      className="siteHeader"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="siteHeaderInner">
        <Link className="brandMark" href="/">
          <span className="brandGlyph">P</span>
          <span>Parley</span>
        </Link>

        <nav className="siteNav">
          {navLinks.map((link) =>
            link.external ? (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ) : (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <Link className="headerCta" href="/start">
          Start Building
        </Link>
      </div>
    </motion.header>
  );
}

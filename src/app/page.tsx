import Link from "next/link";
import { AnimatedHero } from "./animated-hero";
import { HowItWorks } from "./how-it-works";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { basescanTxUrl, verifiedSettlement } from "./verified-settlement";

export default function Home() {
  return (
    <main className="shell">
      <SiteHeader />

      <AnimatedHero />

      <HowItWorks />

      <section className="valueSplit">
        <div className="valueSplitCard">
          <p className="eyebrow">For sellers</p>
          <h3>Close more deals without cutting your margin.</h3>
          <p>
            Your price floor is enforced by a deterministic engine on every single offer — Parley can never accept
            below it, no matter what a buyer asks for.
          </p>
        </div>
        <div className="valueSplitCard">
          <p className="eyebrow">For buyers</p>
          <h3>Never pay a fixed, take-it-or-leave-it price again.</h3>
          <p>Bundle discounts, loyalty pricing, and rush fees are negotiated automatically, round by round.</p>
        </div>
      </section>

      <section id="proof" className="proofPanel">
        <div className="proofHeader">
          <div>
            <p className="eyebrow">Real settlement, not a simulation</p>
            <h2>One full CAP order lifecycle, on-chain</h2>
            <p className="proofNote">
              Captured during development so this proof doesn&apos;t depend on re-running (and re-paying for) a live
              settlement for every visitor. Every hash below is independently verifiable on Basescan.
            </p>
          </div>
          <div className="proofPrice">
            <span>Settled</span>
            <strong>
              {verifiedSettlement.finalPrice} {verifiedSettlement.currency}
            </strong>
          </div>
        </div>
        <div className="txGrid">
          <a className="txCard" href={basescanTxUrl(verifiedSettlement.chain.createTxHash)} target="_blank" rel="noreferrer">
            <span className="miniLabel">1. Order created</span>
            <code>{verifiedSettlement.chain.createTxHash.slice(0, 18)}&hellip;</code>
          </a>
          <a className="txCard" href={basescanTxUrl(verifiedSettlement.chain.payTxHash)} target="_blank" rel="noreferrer">
            <span className="miniLabel">2. Escrow paid</span>
            <code>{verifiedSettlement.chain.payTxHash.slice(0, 18)}&hellip;</code>
          </a>
          <a className="txCard" href={basescanTxUrl(verifiedSettlement.chain.deliverTxHash)} target="_blank" rel="noreferrer">
            <span className="miniLabel">3. Delivered &amp; cleared</span>
            <code>{verifiedSettlement.chain.deliverTxHash.slice(0, 18)}&hellip;</code>
          </a>
        </div>
      </section>

      <section className="devSection">
        <div>
          <p className="eyebrow">For developers</p>
          <h3>The protocol underneath</h3>
          <p>
            Deterministic negotiation engine, Ed25519-signed messages, a seller registry that never leaks reservation
            prices, and standalone agent processes that speak the wire protocol directly — no framework required.
          </p>
        </div>
        <div className="devSectionLinks">
          <a href="https://github.com/jenzylove/parley/blob/main/docs/SPEC.md" target="_blank" rel="noreferrer">
            Protocol spec &#8599;
          </a>
          <a href="https://github.com/jenzylove/parley/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noreferrer">
            Architecture &#8599;
          </a>
          <a href="https://github.com/jenzylove/parley/blob/main/docs/CAP_INTEGRATION.md" target="_blank" rel="noreferrer">
            CAP integration &#8599;
          </a>
          <Link href="/demo">Try the live demo &rarr;</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

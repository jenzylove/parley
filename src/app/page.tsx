import { AnimatedHero } from "./animated-hero";
import { NegotiationTheater } from "./negotiation-theater";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { basescanTxUrl, verifiedSettlement } from "./verified-settlement";

export default function Home() {
  return (
    <main className="shell">
      <SiteHeader />

      <AnimatedHero finalPrice={verifiedSettlement.finalPrice} currency={verifiedSettlement.currency} />

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
          <ul className="chipList">
            {verifiedSettlement.policyExplanation.constraintsApplied.map((constraint) => (
              <li key={constraint} className="chip">
                {constraint}
              </li>
            ))}
          </ul>
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

      <div id="theater">
        <NegotiationTheater />
      </div>

      <SiteFooter />
    </main>
  );
}

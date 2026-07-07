import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="footerBrand">
        <span className="brandGlyph brandGlyph--small">P</span>
        <div>
          <strong>Parley</strong>
          <p>Programmable negotiation for AI commerce.</p>
        </div>
      </div>

      <div className="footerLinks">
        <Link href="/start">Start Building</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/demo">Live Negotiation</Link>
        <a href="https://github.com/jenzylove/parley" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://github.com/jenzylove/parley/blob/main/docs/SPEC.md" target="_blank" rel="noreferrer">
          Documentation
        </a>
        <a href="https://cap.croo.network" target="_blank" rel="noreferrer">
          CROO
        </a>
      </div>

      <p className="footerNote">MIT licensed.</p>
    </footer>
  );
}

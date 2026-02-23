import './LandingPage.css';

export default function LandingPage({ onOpenAuth }) {
  return (
    <div className="land-root">
      <div className="land-mesh" />

      <nav className="land-nav">
        <span className="land-logo">HIT<em>IT</em></span>
        <div className="land-nav-right">
          <button className="land-nav-link" onClick={onOpenAuth}>Login</button>
          <button className="land-nav-cta" onClick={onOpenAuth}>Get Started</button>
        </div>
      </nav>

      <section className="land-hero">
        <div className="land-pill">
          <span className="land-pill-dot" /> Performance Platform · Beta
        </div>

        <h1 className="land-headline">
          Hit Your<br />
          <span className="land-headline-accent">Targets.</span><br />
          Every Day.
        </h1>

        <p className="land-body">
          Track anything. Hit every target.<br />
          Built for teams that move fast and mean business.
        </p>

        <div className="land-actions">
          <button className="land-cta" onClick={onOpenAuth}>
            Start for Free
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="land-ghost" onClick={onOpenAuth}>Sign In →</button>
        </div>

        <div className="land-stats">
          {[['12K+','Users'], ['99.9%','Uptime'], ['4.9★','Rating']].map(([v, l]) => (
            <div key={l} className="land-stat">
              <span className="land-stat-val">{v}</span>
              <span className="land-stat-label">{l}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Decorative purple blob */}
      <div className="land-blob" />
    </div>
  );
}
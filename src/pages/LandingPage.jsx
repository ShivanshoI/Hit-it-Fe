import './LandingPage.css';

const ALIBIS = [
  [
    "Hit-It completely changed how we test APIs.", 
    "Incredibly fast and perfectly designed. 🚀",
    "Finally, a suite that doesn't feel clunky.",
    "The best Postman alternative I've used.",
    "Saved our QA team 10+ hours a week."
  ],
  [
    "Cleanest interface in the devtools game.",
    "Love the dark mode and lightning speed. ⚡",
    "Mock servers literally saved our launch.",
    "My whole team migrated in one day.",
    "Unbelievable performance for heavy payloads."
  ],
  [
    "Testing is actually fun and intuitive now.",
    "No more bloated app frameworks draining RAM.",
    "Simple, elegant, and extremely powerful. ✨",
    "A total game changer for our QA process.",
    "The real-time team syncing just works."
  ]
];

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
          <span className="land-pill-dot" /> Performance Platform · Pre-Alfa
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

        <div className="land-alibis-container">
          {ALIBIS.map((row, i) => (
            <div key={i} className={`land-marquee-row ${i % 2 !== 0 ? 'reverse' : ''}`}>
              <div className="land-marquee-content">
                {row.map((text, j) => <div className="land-alibi-card" key={j}>{text}</div>)}
              </div>
              <div className="land-marquee-content" aria-hidden="true">
                {row.map((text, j) => <div className="land-alibi-card" key={j}>{text}</div>)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Decorative purple blob */}
      <div className="land-blob" />
    </div>
  );
}
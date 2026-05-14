import { DM_Sans, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import "./landing.css";

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--ss-font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--ss-font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solusisaji — A POS we'd rather build with you than sell to you.",
  description:
    "Solusisaji handles the queue, the order, the kitchen, and the payment — one system, made for restaurant with real lines at the door.",
};

export default function LandingPage() {
  return (
    <div className={`ss ${dmSans.variable} ${jetbrainsMono.variable}`}>

      {/* ── NAV ── */}
      <nav>
        <div className="container">
          <a href="#" className="logo">
            <MarkA size={30} className="logo-mark" />
            <span className="logo-wordmark">solusi<span className="saji"> saji</span></span>
          </a>
          <div className="nav-meta">
            <span>
              <span className="status-dot" />
              Building in Indonesia
            </span>
            <a href="#talk">let&apos;s talk →</a>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="container">
          <div className="hero-meta">
            <span>v0.1 — early access</span>
            <span className="sep">/</span>
            <span>For multi-location restaurants</span>
            <span className="sep">/</span>
            <span>Jakarta · Bandung · Surabaya</span>
          </div>
          <h1>
            A POS we&apos;d rather <span className="italic">build with you</span> than sell to you.
          </h1>
          <p className="hero-sub">
            Solusisaji handles the queue, the order, the kitchen, and the payment — one system,
            made for restaurant with real lines at the door. Where it goes next, we figure out together.
          </p>
          <div className="cta-row">
            <a href="#talk" className="btn btn-primary">
              Let&apos;s talk
              <ArrowIcon />
            </a>
            <a href="#what" className="btn btn-ghost">See what we built</a>
          </div>
        </div>
      </header>

      {/* ── FIELD NOTES ── */}
      <section className="section-pad">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-tag">
              <span className="num">§ 01</span>
              <span className="label">Field notes</span>
            </div>
            <h2>
              A few things we noticed, <span className="italic">standing in real restaurant.</span>
            </h2>
          </div>
          <div className="notes">
            <div className="notes-spacer" />
            <div>
              <div className="note-row reveal">
                <span className="idx">obs.01</span>
                <div>
                  <h3>The queue lives in people&apos;s heads.</h3>
                  <p>
                    Sometimes on paper, sometimes in a WhatsApp group, sometimes just in the
                    host&apos;s memory.
                  </p>
                </div>
              </div>
              <div className="note-row reveal" style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
                <span className="idx">obs.02</span>
                <div>
                  <h3>The wait is hard to estimate.</h3>
                  <p>For the customer at the door, and for the staff trying to give them an answer.</p>
                </div>
              </div>
              <div className="note-row reveal" style={{ "--reveal-delay": "200ms" } as React.CSSProperties}>
                <span className="idx">obs.03</span>
                <div>
                  <h3>The pieces work, separately.</h3>
                  <p>
                    POS, kitchen, queue, dashboard — usually each one is fine on its own. Connecting
                    them is the part that&apos;s done manually.
                  </p>
                </div>
              </div>
              <p className="notes-close reveal" style={{ "--reveal-delay": "300ms" } as React.CSSProperties}>That&apos;s the part we wanted to make easier.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT WE BUILT ── */}
      <section className="section-pad alt-bg" id="what">
        <div className="container">
          <div className="sec-head reveal">
            <div className="sec-tag">
              <span className="num">§ 02</span>
              <span className="label">What we built</span>
            </div>
            <h2>
              One system. <span className="italic">From the door to the receipt.</span>
            </h2>
          </div>

          <div className="built-grid">
            <div className="built-card reveal">
              <div className="icon-frame">Q</div>
              <span className="tag">module</span>
              <h3>Queue</h3>
              <p>Customers join from their phone. They know where they stand. You know who&apos;s still waiting.</p>
            </div>
            <div className="built-card reveal" style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
              <div className="icon-frame">O</div>
              <span className="tag">module</span>
              <h3>Order &amp; kitchen</h3>
              <p>From tablet to kitchen screen in seconds.</p>
            </div>
            <div className="built-card reveal" style={{ "--reveal-delay": "200ms" } as React.CSSProperties}>
              <div className="icon-frame">P</div>
              <span className="tag">module</span>
              <h3>Payment</h3>
              <p>QRIS, e-wallets, transfer. Receipt to the customer&apos;s phone.</p>
            </div>
            <div className="built-card reveal" style={{ "--reveal-delay": "300ms" } as React.CSSProperties}>
              <div className="icon-frame">D</div>
              <span className="tag">module</span>
              <h3>Dashboard</h3>
              <p>Sales, wait times, table turn, peak hours — live, in one place.</p>
            </div>
          </div>

          <div className="analytics-block reveal">
            <div className="ab-head">
              <span className="label">
                <span className="signal-dot" />
                OUR EDGE
              </span>
              <span className="label">/ analytics</span>
            </div>
            <h3>
              Where we&apos;re sharpest: <span className="italic">the analytics.</span>
            </h3>
            <div className="questions">
              <div className="q-row">
                <span className="q-num">Q.01</span>
                <p>How long does cleaning a table actually take, on average, on a Saturday at 1pm?</p>
              </div>
              <div className="q-row">
                <span className="q-num">Q.02</span>
                <p>
                  Which items walk out the door the moment they&apos;re available, and which ones
                  quietly underperform?
                </p>
              </div>
              <div className="q-row">
                <span className="q-num">Q.03</span>
                <p>When does the queue start losing people — and is it the wait, or the visibility?</p>
              </div>
            </div>
            <div className="analytics-foot">
              → These are operator questions. We built the system to answer them.
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW WE WORK ── */}
      <section className="section-pad" id="talk">
        <div className="container">
          <div className="sec-head sec-head--solo reveal">
            <h2>
              A working relationship, <span className="italic">not a contract.</span>
            </h2>
          </div>

          <div className="principles-grid">
            <div className="principle reveal">
              <div className="p-tag">P.01</div>
              <h3>One outlet at a time.</h3>
              <p>We start where the problem is sharpest.</p>
            </div>
            <div className="principle reveal" style={{ "--reveal-delay": "100ms" } as React.CSSProperties}>
              <div className="p-tag">P.02</div>
              <h3>Short cycles.</h3>
              <p>You tell us what&apos;s missing. We ship in weeks, not quarters.</p>
            </div>
            <div className="principle reveal" style={{ "--reveal-delay": "200ms" } as React.CSSProperties}>
              <div className="p-tag">P.03</div>
              <h3>Grounded in your numbers.</h3>
              <p>Every decision we make together is based on your data.</p>
            </div>
            <div className="principle reveal" style={{ "--reveal-delay": "300ms" } as React.CSSProperties}>
              <div className="p-tag">P.04</div>
              <h3>Your data, yours.</h3>
              <p>Exportable, anytime.</p>
            </div>
          </div>

          <div className="close-block reveal">
            <p className="close-text">
              If this sounds like the way you&apos;d want to work with software,{" "}
              <span className="italic">let&apos;s talk.</span>
            </p>
            <a href="mailto:contact@solusisaji.com" className="btn btn-primary">
              Let&apos;s talk
              <ArrowIcon />
            </a>
          </div>
        </div>
      </section>

      <Script id="ss-reveal" strategy="afterInteractive">{`
(function(){
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
    });
  },{threshold:0.12});
  document.querySelectorAll('.ss .reveal').forEach(function(el){io.observe(el);});
})();
`}</Script>

      {/* ── FOOTER ── */}
      <footer>
        <div className="container">
          <div className="foot-grid">
            <div className="foot-logo">
              <MarkA size={28} stroke="#F5EFE6" sCut="#2A1810" />
              solusi<span className="saji"> saji</span>
            </div>
            <p className="foot-tag">A POS we&apos;d rather build with you than sell to you.</p>
            <div className="foot-links">
              <a href="mailto:contact@solusisaji.com">email</a>
              <a href="http://wa.me/6281933221195">whatsapp</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 solusisaji</span>
            <span>solusisaji.com / built in tangerang</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Direction A — Cloche mark (extracted verbatim from standalone HTML) ── */
function MarkA({
  size = 36,
  color = "#C8553D",
  stroke = "#2A1810",
  sCut,
  className,
}: {
  size?: number;
  color?: string;
  stroke?: string;
  sCut?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      {/* handle */}
      <circle cx="50" cy="14" r="4" fill={stroke} />
      {/* dome */}
      <path d="M14 60 A36 36 0 0 1 86 60 Z" fill={color} />
      {/* S cut — negative space carved from dome */}
      <path
        d="M62 36 Q50 32 42 40 Q34 48 46 52 Q58 56 50 62"
        fill="none"
        stroke={sCut ?? "#F5EFE6"}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* base plate */}
      <rect x="8" y="62" width="84" height="6" rx="3" fill={stroke} />
      {/* steam ticks */}
      <circle cx="36" cy="76" r="1.6" fill={stroke} opacity="0.5" />
      <circle cx="50" cy="78" r="1.6" fill={stroke} opacity="0.5" />
      <circle cx="64" cy="76" r="1.6" fill={stroke} opacity="0.5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M1 6H11M11 6L6 1M11 6L6 11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

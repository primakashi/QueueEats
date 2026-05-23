import { DM_Serif_Display, DM_Sans } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import "./landing.css";

const dmSerif = DM_Serif_Display({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solusisaji — A restaurant suite we'd rather build with you than sell to you.",
  description:
    "Everything between the door and the receipt. One system, no gaps in between.",
};

export default function LandingPage() {
  return (
    <div className={`sl ${dmSerif.variable} ${dmSans.variable}`}>

      {/* ── NAV ── */}
      <nav>
        <a href="#" className="nav-brand">solusisaji</a>
        <a href="#talk" className="nav-cta">let&apos;s talk →</a>
      </nav>

      {/* ── HERO ── */}
      <section className="hero">
        <div className="wrap">
          <h1 className="fi">
            A restaurant suite we&apos;d rather <em>build with you</em> than sell to you.
          </h1>
          <p className="hero-sub fi">
            Everything between the door and the receipt. One system, no gaps in between.
          </p>
          <div className="hero-modules fi">
            <div className="hero-module">
              <div className="hero-module-name">Queue</div>
              <p className="hero-module-desc">
                Customers join from their phone. They see where they stand. You see who&apos;s still
                waiting, and who left.
              </p>
            </div>
            <div className="hero-module">
              <div className="hero-module-name">Order &amp; kitchen</div>
              <p className="hero-module-desc">Tablet to kitchen screen in seconds. No paper, no relay.</p>
            </div>
            <div className="hero-module">
              <div className="hero-module-name">Payment</div>
              <p className="hero-module-desc">QRIS, e-wallets, transfer. Receipt to the customer&apos;s phone.</p>
            </div>
            <div className="hero-module">
              <div className="hero-module-name">Reporting</div>
              <p className="hero-module-desc">Sales, wait times, table turn, peak hours. One place.</p>
            </div>
          </div>
          <a href="#talk" className="hero-cta fi">Let&apos;s talk</a>
        </div>
      </section>

      {/* ── ANALYTICS ── */}
      <section className="analytics">
        <div className="wrap">
          <div className="section-label section-label--accent fi">Analytics</div>
          <h2 className="fi">The questions your current tools don&apos;t answer.</h2>
          <div className="analytics-questions">
            <div className="a-q fi">
              <span className="a-q-num">Q.01</span>
              <p className="a-q-text">
                Which menu items sell out before 1pm every weekend, and how many orders reach the
                kitchen after they&apos;re already gone?
              </p>
            </div>
            <div className="a-q fi">
              <span className="a-q-num">Q.02</span>
              <p className="a-q-text">
                Your bestseller sells itself. But which items have been sitting on the menu, quietly
                underperforming, for months?
              </p>
            </div>
            <div className="a-q fi">
              <span className="a-q-num">Q.03</span>
              <p className="a-q-text">
                How many customers left your weekend queue before being seated, and was it the wait,
                or the fact that they couldn&apos;t see it moving?
              </p>
            </div>
          </div>
          <p className="analytics-close fi">
            Everyone has a sales dashboard. These are operator questions. The system is built to
            answer them.
          </p>
        </div>
      </section>

      {/* ── RELATIONSHIP ── */}
      <section className="relationship">
        <div className="wrap">
          <div className="section-label section-label--dark fi">The relationship</div>
          <h2 className="fi">
            You&apos;re not buying software. You&apos;re gaining a team that cares how your
            restaurant runs.
          </h2>
          <p className="relationship-sub fi">
            The product keeps moving. Shaped by what you&apos;re actually dealing with, not a
            roadmap you never see.
          </p>
          <div className="principles">
            <div className="fi">
              <div className="p-id">P.01</div>
              <div className="p-title">One outlet at a time.</div>
              <p className="p-desc">We start where the problem is sharpest.</p>
            </div>
            <div className="fi">
              <div className="p-id">P.02</div>
              <div className="p-title">Short cycles.</div>
              <p className="p-desc">You tell us what&apos;s missing. We build it in weeks, not quarters.</p>
            </div>
            <div className="fi">
              <div className="p-id">P.03</div>
              <div className="p-title">Your data, yours.</div>
              <p className="p-desc">Grounded in your numbers. Exportable, anytime.</p>
            </div>
            <div className="fi">
              <div className="p-id">P.04</div>
              <div className="p-title">Your data partner.</div>
              <p className="p-desc">
                We built the analytics because we know how to use them. That expertise is part of
                what you&apos;re getting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEMO ── */}
      <section className="demo">
        <div className="wrap">
          <div className="section-label section-label--dark fi">Live product</div>
          <h2 className="fi">See it working. Not a mockup.</h2>
          <p className="demo-sub fi">
            A working prototype with real data. Book a demo and we&apos;ll walk you through it with
            your menu.
          </p>

          <div className="demo-frame fi">
            <div className="demo-bar">
              <div className="demo-dot" />
              <div className="demo-dot" />
              <div className="demo-dot" />
              <span className="demo-bar-title">solusisaji — dashboard</span>
            </div>
            <div className="demo-body">
              <div className="demo-stats">
                <div className="demo-stat">
                  <div className="demo-stat-label">Total revenue</div>
                  <div className="demo-stat-value">
                    Rp 387M <span className="demo-stat-badge">+4.2%</span>
                  </div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat-label">Total orders</div>
                  <div className="demo-stat-value">
                    10,092 <span className="demo-stat-badge">+3.0%</span>
                  </div>
                </div>
                <div className="demo-stat">
                  <div className="demo-stat-label">Avg order value</div>
                  <div className="demo-stat-value">Rp 38,349</div>
                </div>
              </div>
              <div className="demo-chart">
                {[45,38,62,42,55,35,50,40,58,44,48,36,52,30].map((h, i) => (
                  <div key={i} className="demo-chart-bar" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="demo-ai">
                <div className="demo-ai-head">
                  <div className="demo-ai-icon" />
                  <span className="demo-ai-title">AI Analysis</span>
                </div>
                <p className="demo-ai-text">
                  Revenue up 4.2% with highest contribution from main branch. Peak traffic at
                  07:00–08:00 with 54 orders. Recommended: add 1 staff during peak for +6–12%
                  throughput.
                </p>
              </div>
            </div>
          </div>

          <div className="demo-cta-wrap fi">
            <a href="mailto:contact@solusisaji.com" className="demo-cta">Book a demo</a>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" id="talk">
        <div className="wrap">
          <h2 className="fi">
            More affordable than what you&apos;re paying now. More valuable than what you&apos;re
            getting.
          </h2>
          <p className="cta-line fi">
            Restaurants that stay ahead don&apos;t just serve better food. They run better
            operations.
          </p>
          <div className="cta-buttons fi">
            <a href="mailto:contact@solusisaji.com" className="cta-primary">Let&apos;s talk</a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer>
        <div className="wrap">
          <div className="footer-inner">
            <span className="footer-brand">solusisaji</span>
            <div className="footer-links">
              <a href="mailto:contact@solusisaji.com">email</a>
              <a href="https://wa.me/6281933221195" target="_blank" rel="noopener noreferrer">
                whatsapp
              </a>
              <span className="footer-copy">© 2026 solusisaji</span>
            </div>
          </div>
        </div>
      </footer>

      <Script id="sl-reveal" strategy="afterInteractive">{`
(function(){
  var o = new IntersectionObserver(function(e){
    e.forEach(function(el){ if(el.isIntersecting) el.target.classList.add('v'); });
  },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.sl .fi').forEach(function(el){ o.observe(el); });
})();
`}</Script>
    </div>
  );
}

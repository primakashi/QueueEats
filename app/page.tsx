import { DM_Sans, Instrument_Serif } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
import "./landing.css";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solusisaji — Sistem restoran lengkap, satu layar.",
  description: "Antrian, order, dapur, bayar, laporan. Satu sistem.",
};

const WA_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.119.553 4.106 1.516 5.834L.053 23.52a.5.5 0 00.607.596l5.465-1.572A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.82a9.82 9.82 0 01-5.217-1.497l-.374-.224-3.26.938.868-3.354-.235-.374A9.802 9.802 0 012.18 12 9.82 9.82 0 0112 2.18 9.82 9.82 0 0121.82 12 9.82 9.82 0 0112 21.82z" />
  </svg>
);

const CHART_HEIGHTS = [15, 22, 40, 85, 100, 78, 55, 62, 90, 95, 70, 45, 20];

export default function LandingPage() {
  return (
    <div className={`sl ${instrumentSerif.variable} ${dmSans.variable}`}>

      {/* NAV */}
      <nav>
        <div className="nav-inner">
          <div className="logo">solusisaji</div>
          <a
            className="nav-cta"
            href="https://wa.me/6281933221195?text=Halo%2C%20saya%20tertarik%20dengan%20Solusisaji"
            target="_blank"
            rel="noopener noreferrer"
          >
            {WA_ICON}
            WhatsApp kami
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-label fi">Sistem restoran all-in-one</div>
        <h1 className="fi">
          Antrian, order, dapur, bayar, laporan. <em>Satu sistem.</em>
        </h1>
        <p className="hero-sub fi">
          Untuk restoran yang tidak perlu teriak ke dapur, tidak pakai nota kertas, dan tahu persis
          kenapa weekend kemarin sepi.
        </p>
        <div className="hero-actions fi">
          <a
            className="btn-wa"
            href="https://wa.me/6281933221195?text=Halo%2C%20saya%20mau%20lihat%20demo%20Solusisaji"
            target="_blank"
            rel="noopener noreferrer"
          >
            {WA_ICON}
            Lihat demo via WhatsApp
          </a>
          <a className="btn-secondary" href="#pricing">Lihat harga</a>
        </div>
      </section>

      {/* PRODUCT FRAME */}
      <div className="product-frame fi">
        <div className="product-screen">
          <div className="screen-bar">
            <div className="screen-dot" />
            <div className="screen-dot" />
            <div className="screen-dot" />
          </div>
          <div className="dashboard-mock">
            <div className="stat-card">
              <div className="stat-label">Revenue hari ini</div>
              <div className="stat-value">Rp 14.2jt</div>
              <div className="stat-delta">↑ 12% vs Senin lalu</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total orders</div>
              <div className="stat-value">187</div>
              <div className="stat-delta">↑ 8%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg. tunggu antrian</div>
              <div className="stat-value">11 min</div>
              <div className="stat-delta stat-delta--down">↑ 3 min dari target</div>
            </div>
            <div className="chart-area">
              <div className="stat-label">Orders per jam</div>
              <div className="chart-bars">
                {CHART_HEIGHTS.map((h, i) => (
                  <div
                    key={i}
                    className={`chart-bar${h >= 78 ? " chart-bar--hi" : ""}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="queue-row">
              {[
                { id: "A-012", table: "Meja 4 · 3 orang", status: "seated", label: "Seated" },
                { id: "A-013", table: "Meja 7 · 5 orang", status: "kitchen", label: "Di dapur" },
                { id: "A-014", table: "Walk-in · 2 orang", status: "waiting", label: "Menunggu" },
                { id: "A-015", table: "Walk-in · 4 orang", status: "waiting", label: "Menunggu" },
              ].map((t) => (
                <div className="queue-ticket" key={t.id}>
                  <strong>{t.id}</strong>
                  <div>{t.table}</div>
                  <div className={`queue-status queue-status--${t.status}`}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="features-section">
        <div className="section-label fi">Fitur</div>
        <h2 className="section-title fi">Dari pintu masuk sampai struk keluar. Tidak ada celah.</h2>
        <div className="features-grid">
          {[
            {
              icon: "📱",
              title: "Antrian digital",
              desc: "Pelanggan scan QR, dapat nomor antrian, lihat posisi real-time dari HP mereka. Anda lihat siapa yang masih nunggu dan siapa yang cabut.",
            },
            {
              icon: "🍳",
              title: "Order → Dapur",
              desc: "Tablet ke layar dapur dalam detik. Tidak ada kertas hilang, tidak ada salah dengar. Modifikasi pesanan langsung update.",
            },
            {
              icon: "💳",
              title: "Pembayaran",
              desc: "QRIS, e-wallet, transfer bank. Struk otomatis ke HP pelanggan. Rekonsiliasi otomatis di akhir hari.",
            },
            {
              icon: "📊",
              title: "Laporan & analytics",
              desc: "Bukan cuma total sales. Tahu menu mana yang underperform, jam berapa harus tambah staf, dan kenapa Sabtu kemarin drop.",
            },
          ].map((f) => (
            <div className="feature-card fi" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="proof-section">
        <div className="proof-inner">
          <div className="section-label fi">Kata mereka</div>
          <div className="proof-grid">
            <div className="fi">
              <p className="proof-quote">
                &ldquo;Sebelumnya kita cuma tau total penjualan. Sekarang kita tau jam berapa harus
                standby, menu mana yang harus di-push, dan kapan bisa pulang.&rdquo;
              </p>
              <div className="proof-attr">
                <strong>Owner, warung nasi Padang</strong>
                <br />
                Tangerang · 120+ order/hari
              </div>
            </div>
            <div className="fi">
              <p className="proof-quote">
                &ldquo;Yang paling kerasa itu antrian digital. Weekend nggak ada lagi pelanggan pergi
                karena nggak tau harus nunggu berapa lama.&rdquo;
              </p>
              <div className="proof-attr">
                <strong>Manager, cafe &amp; resto</strong>
                <br />
                Jakarta Selatan · 2 outlet
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section className="analytics-section">
        <div className="section-label fi">Analytics</div>
        <h2 className="section-title fi">Pertanyaan yang POS biasa tidak bisa jawab.</h2>
        <div className="analytics-questions">
          {[
            {
              num: "01",
              text: (
                <>
                  <strong>Menu mana yang habis sebelum jam 1 siang tiap weekend?</strong> Dan berapa
                  order masuk ke dapur setelah stok udah kosong?
                </>
              ),
            },
            {
              num: "02",
              text: (
                <>
                  <strong>Berapa pelanggan cabut dari antrian sebelum dapat meja?</strong> Apa karena
                  lama, atau karena mereka tidak bisa lihat antriannya bergerak?
                </>
              ),
            },
            {
              num: "03",
              text: (
                <>
                  <strong>
                    Bestseller kamu memang jual sendiri. Tapi menu mana yang sudah berbulan-bulan
                    tidak perform
                  </strong>{" "}
                  dan diam-diam makan tempat di dapur?
                </>
              ),
            },
          ].map((q) => (
            <div className="aq-item fi" key={q.num}>
              <div className="aq-num">{q.num}</div>
              <p>{q.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section className="pricing-section" id="pricing">
        <div className="section-label fi">Cara mulai</div>
        <h2 className="section-title fi">Satu outlet dulu. Baru bicara angka.</h2>
        <p className="pricing-intro fi">
          Harga ditentukan setelah kita tahu ukuran dan kebutuhan outlet kamu — bukan sebelumnya.
          Yang pasti: lebih hemat dari yang kamu bayar sekarang.
        </p>
        <div className="pricing-cards">
          <div className="price-card fi">
            <div className="stage-badge">Tahap 1</div>
            <div className="price-name">Pilot</div>
            <div className="price-anchor">Gratis. Tanpa kontrak.</div>
            <p className="price-desc">
              30–60 hari di satu outlet. Sistem berjalan paralel dengan yang kamu pakai sekarang.
              Kalau tidak cocok, tidak ada yang perlu diputuskan.
            </p>
            <ul className="price-list">
              <li>Antrian digital</li>
              <li>Order &amp; dapur display</li>
              <li>Pembayaran QRIS</li>
              <li>Laporan harian</li>
              <li>Pendampingan langsung dari kami</li>
            </ul>
            <a
              className="price-cta price-cta--outline"
              href="https://wa.me/6281933221195?text=Halo%2C%20saya%20tertarik%20coba%20pilot%20Solusisaji"
              target="_blank"
              rel="noopener noreferrer"
            >
              Mulai pilot
            </a>
          </div>
          <div className="price-card price-card--featured fi">
            <div className="stage-badge">Tahap 2</div>
            <div className="price-name">Full rollout</div>
            <div className="price-anchor">Lebih rendah dari invoice kamu sekarang.</div>
            <p className="price-desc">
              Setelah pilot terbukti, kita bicara angka yang sesuai skala outlet kamu — multi-lokasi,
              modul penuh, analytics lengkap.
            </p>
            <ul className="price-list">
              <li>Semua fitur pilot</li>
              <li>Advanced analytics &amp; AI insights</li>
              <li>Multi-outlet dashboard</li>
              <li>Custom reporting</li>
              <li>Dedicated account manager</li>
              <li>Data export kapan saja</li>
            </ul>
            <a
              className="price-cta price-cta--filled"
              href="https://wa.me/6281933221195?text=Halo%2C%20saya%20ingin%20tahu%20lebih%20lanjut%20tentang%20Solusisaji"
              target="_blank"
              rel="noopener noreferrer"
            >
              Diskusi dulu
            </a>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-section">
        <div className="how-inner">
          <div className="section-label fi">Cara kerja</div>
          <h2 className="section-title fi">Dari WhatsApp ke live dalam 1 minggu.</h2>
          <div className="how-steps">
            {[
              {
                num: "1",
                title: "Chat kami",
                desc: "Ceritakan situasi resto kamu sekarang. Tidak ada sales pitch — kami dengerin dulu.",
              },
              {
                num: "2",
                title: "Demo dengan data kamu",
                desc: "Kami setup demo pakai menu dan layout meja kamu yang sebenarnya, bukan template generik.",
              },
              {
                num: "3",
                title: "Live di outlet",
                desc: "Kita datang, pasang, training staf. Satu minggu dari pertama chat sampai jalan.",
              },
            ].map((s) => (
              <div className="how-step fi" key={s.num}>
                <div className="how-step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-cta">
        <h2 className="fi">Mau lihat dashboard-nya jalan pakai menu kamu?</h2>
        <p className="fi">Demo gratis, 15 menit, lewat WhatsApp. Tidak ada kontrak, tidak ada pressure.</p>
        <a
          className="btn-wa fi"
          href="https://wa.me/6281933221195?text=Halo%2C%20saya%20mau%20lihat%20demo%20Solusisaji%20pakai%20menu%20saya"
          target="_blank"
          rel="noopener noreferrer"
        >
          {WA_ICON}
          Chat sekarang
        </a>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-left">© 2026 solusisaji</div>
          <div className="footer-links">
            <a href="mailto:contact@solusisaji.com">Email</a>
            <a href="https://wa.me/6281933221195" target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </div>
        </div>
      </footer>

      <Script id="sl-reveal" strategy="afterInteractive">{`
(function(){
  var o = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('v'); o.unobserve(e.target); } });
  },{threshold:0.12});
  document.querySelectorAll('.sl .fi').forEach(function(el){ o.observe(el); });
})();
`}</Script>
    </div>
  );
}

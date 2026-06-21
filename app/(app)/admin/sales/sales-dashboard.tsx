"use client";

import { useMemo, useState } from "react";
import {
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_LABEL,
  type OrderStatus,
} from "@/lib/types";
import type {
  MenuCategory,
  MenuItem,
  OrderChannelConfig,
  Outlet,
} from "@/lib/types";
import type { SalesOrder, SalesCashierSession } from "./page";
import styles from "./sales.module.css";

type Granularity = "day" | "hour" | "month";
type ChartType = "bar" | "line";
type Preset = "today" | "yesterday" | "7d" | "30d" | "thismonth" | "lastmonth" | "custom";

const ALL = "ALL";

const SLOTS = [
  { label: "Pagi (07–11)", from: 7, to: 10, color: "#A7AE86" },
  { label: "Siang (11–14)", from: 11, to: 13, color: "#6E7B4F" },
  { label: "Sore (14–17)", from: 14, to: 16, color: "#454E2F" },
  { label: "Malam (17–21)", from: 17, to: 23, color: "#241C15" },
] as const;

const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MON_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmt(n: number): string {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function fmtN(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(Math.round(n));
}

function toInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromInput(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function shortDate(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function prettyDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]}, ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function slotOf(h: number) {
  for (const s of SLOTS) if (h >= s.from && h <= s.to) return s;
  return SLOTS[3];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

type FilterState = {
  from: Date;
  to: Date;
  product: string;
  pay: string;
  channel: string;
  outlet: string;
};

function passSales(o: SalesOrder, f: FilterState, channelLabelOf: (id: string | null) => string): boolean {
  const t = new Date(o.created_at).getTime();
  const fromT = f.from.getTime();
  const toT = new Date(f.to).setHours(23, 59, 59, 999);
  if (t < fromT || t > toT) return false;
  if (o.payment_status !== "paid") return false;
  if (f.outlet !== ALL && o.outlet_id !== f.outlet) return false;
  if (f.pay !== ALL && o.payment_method !== f.pay) return false;
  if (f.channel !== ALL && channelLabelOf(o.order_channel) !== f.channel) return false;
  if (f.product !== ALL && !o.items.some((it) => it.menu_item_id === f.product)) return false;
  return true;
}

function lineVal(o: SalesOrder, product: string): number {
  if (product === ALL) return o.total;
  let sum = 0;
  for (const it of o.items) if (it.menu_item_id === product) sum += it.price * it.quantity;
  return sum;
}

function lineQty(o: SalesOrder, product: string): number {
  if (product === ALL) return o.items.reduce((s, it) => s + it.quantity, 0);
  let q = 0;
  for (const it of o.items) if (it.menu_item_id === product) q += it.quantity;
  return q;
}

type Bucket = { key: string; label: string; full: string; v: number; n: number };

function buckets(sales: SalesOrder[], gran: Granularity, f: FilterState): Bucket[] {
  if (gran === "hour") {
    const map = new Map<number, { v: number; n: number }>();
    for (let h = 7; h <= 22; h++) map.set(h, { v: 0, n: 0 });
    for (const o of sales) {
      const h = new Date(o.created_at).getHours();
      const b = map.get(h);
      if (b) {
        b.v += lineVal(o, f.product);
        b.n += 1;
      }
    }
    return [...map.entries()].map(([h, o]) => ({
      key: String(h),
      label: `${pad(h)}.00`,
      full: `${pad(h)}:00`,
      v: o.v,
      n: o.n,
    }));
  }

  if (gran === "day") {
    const map = new Map<string, { v: number; n: number; d: Date }>();
    let d = new Date(f.from);
    while (d <= f.to) {
      const k = toInput(d);
      map.set(k, { v: 0, n: 0, d: new Date(d) });
      d = addDays(d, 1);
    }
    for (const o of sales) {
      const ts = new Date(o.created_at);
      const k = toInput(ts);
      const b = map.get(k);
      if (b) {
        b.v += lineVal(o, f.product);
        b.n += 1;
      }
    }
    return [...map.entries()].map(([k, o]) => ({
      key: k,
      label: shortDate(o.d),
      full: prettyDate(o.d),
      v: o.v,
      n: o.n,
    }));
  }

  // month
  const map = new Map<string, { v: number; n: number }>();
  for (const o of sales) {
    const ts = new Date(o.created_at);
    const k = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}`;
    const b = map.get(k) ?? { v: 0, n: 0 };
    b.v += lineVal(o, f.product);
    b.n += 1;
    map.set(k, b);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, o]) => {
      const m = Number(k.slice(5, 7));
      return {
        key: k,
        label: MON_SHORT[m - 1]!,
        full: `${MON_FULL[m - 1]} ${k.slice(0, 4)}`,
        v: o.v,
        n: o.n,
      };
    });
}

export function SalesDashboard({
  orders,
  outlets,
  channels,
  categories,
  menuItems,
  sessions,
  initialOutlet,
  lockedOutletId,
  lockedOutletName,
}: {
  orders: SalesOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
  channels: OrderChannelConfig[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
  sessions: SalesCashierSession[];
  initialOutlet?: string;
  lockedOutletId: string | null;
  lockedOutletName: string | null;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const channelLabelOf = useMemo(() => {
    const map = new Map(channels.map((c) => [c.id, c.name]));
    return (id: string | null): string => {
      if (!id) return "Langsung";
      return map.get(id) ?? ORDER_CHANNEL_LABEL[id] ?? id;
    };
  }, [channels]);

  const categoryNameOf = useMemo(() => {
    const cats = new Map(categories.map((c) => [c.id, c.name]));
    const items = new Map(menuItems.map((m) => [m.id, m.category_id]));
    return (menuItemId: string | null): string => {
      if (!menuItemId) return "—";
      const cid = items.get(menuItemId);
      if (!cid) return "—";
      return cats.get(cid) ?? "—";
    };
  }, [categories, menuItems]);

  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState<Date>(() => addDays(today, -29));
  const [to, setTo] = useState<Date>(today);
  const [gran, setGran] = useState<Granularity>("day");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [product, setProduct] = useState<string>(ALL);
  const [pay, setPay] = useState<string>(ALL);
  const [channel, setChannel] = useState<string>(ALL);
  const [outletF, setOutletF] = useState<string>(initialOutlet ?? ALL);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "today") {
      setFrom(today);
      setTo(today);
    } else if (p === "yesterday") {
      const y = addDays(today, -1);
      setFrom(y);
      setTo(y);
    } else if (p === "7d") {
      setFrom(addDays(today, -6));
      setTo(today);
    } else if (p === "30d") {
      setFrom(addDays(today, -29));
      setTo(today);
    } else if (p === "thismonth") {
      setFrom(startOfMonth(today));
      setTo(today);
    } else if (p === "lastmonth") {
      const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      setFrom(last);
      setTo(endOfMonth(last));
    }
  }

  function reset() {
    setProduct(ALL);
    setPay(ALL);
    setChannel(ALL);
    if (!lockedOutletId) setOutletF(ALL);
    setGran("day");
    setChartType("bar");
    applyPreset("30d");
  }

  const filter: FilterState = useMemo(() => ({
    from,
    to,
    product,
    pay,
    channel,
    outlet: lockedOutletId ?? outletF,
  }), [from, to, product, pay, channel, outletF, lockedOutletId]);

  const sales = useMemo(
    () => orders.filter((o) => passSales(o, filter, channelLabelOf)),
    [orders, filter, channelLabelOf],
  );

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const single = toInput(from) === toInput(to);

  const omzet = useMemo(() => sales.reduce((s, o) => s + lineVal(o, filter.product), 0), [sales, filter.product]);
  const orderCount = sales.length;
  const itemCount = useMemo(() => sales.reduce((s, o) => s + lineQty(o, filter.product), 0), [sales, filter.product]);
  const aov = orderCount > 0 ? omzet / orderCount : 0;
  const perDay = days > 0 ? omzet / days : 0;
  const fset = product !== ALL || pay !== ALL || channel !== ALL || (!lockedOutletId && outletF !== ALL);

  const bk = useMemo(() => buckets(sales, gran, filter), [sales, gran, filter]);

  const periodLabel = single
    ? prettyDate(from)
    : `${prettyDate(from)} – ${prettyDate(to)} (${days} hari)`;

  // Channel options: all configured channels + any from order history
  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of channels) set.add(c.name);
    set.add("Langsung");
    for (const o of orders) set.add(channelLabelOf(o.order_channel));
    return [...set].sort();
  }, [channels, orders, channelLabelOf]);

  // Payment method options derived from data
  const payOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) if (o.payment_method) set.add(o.payment_method);
    return [...set].sort();
  }, [orders]);

  function exportPDF() {
    doExport({
      sales,
      filter,
      gran,
      single,
      days,
      omzet,
      orderCount,
      itemCount,
      aov,
      perDay,
      periodLabel,
      outletName: lockedOutletName ?? outlets.find((o) => o.id === outletF)?.name ?? "Semua Outlet",
      channelLabelOf,
      categoryNameOf,
      menuItems,
      sessions,
    });
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.mast}>
          <div className={styles.brand}>solusi<b>saji</b></div>
          <div className={styles.ctx}>
            <span className={styles.role}>Laporan Penjualan</span>
            {lockedOutletName && (
              <span className={styles.lock}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                <span>{lockedOutletName}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={styles.h1 + " " + styles.serif}>Penjualan Outlet</div>
        <p className={styles.sub}>
          {lockedOutletName
            ? "Akses terkunci ke satu outlet · laporan harian & bulanan untuk diserahkan ke pemilik"
            : "Rekap penjualan lintas outlet · filter periode, channel, metode, dan produk"}
        </p>

        {/* FILTER CARD */}
        <div className={styles.filtercard}>
          <div className={styles.frow}>
            <div>
              <span className={styles.flabel}>Periode</span>
              <div className={styles.presets}>
                {([
                  ["today", "Hari ini"],
                  ["yesterday", "Kemarin"],
                  ["7d", "7 hari"],
                  ["30d", "30 hari"],
                  ["thismonth", "Bulan ini"],
                  ["lastmonth", "Bulan lalu"],
                ] as [Preset, string][]).map(([p, label]) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.chip} ${preset === p ? styles.chipOn : ""}`}
                    onClick={() => applyPreset(p)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.daterange}>
              <div className={styles.field}>
                <span className={styles.flabel}>Dari</span>
                <input
                  type="date"
                  className={styles.input}
                  value={toInput(from)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setPreset("custom");
                    setFrom(fromInput(e.target.value));
                  }}
                />
              </div>
              <div className={styles.field}>
                <span className={styles.flabel}>Sampai</span>
                <input
                  type="date"
                  className={styles.input}
                  value={toInput(to)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setPreset("custom");
                    setTo(fromInput(e.target.value));
                  }}
                />
              </div>
            </div>
            <div className={styles.activelabel}>
              <b>{single ? prettyDate(from) : `${shortDate(from)} – ${shortDate(to)}`}</b> · {days} hari
            </div>
          </div>

          <div className={styles.frow}>
            <div>
              <span className={styles.flabel}>Kelompok grafik</span>
              <div className={styles.seg}>
                {([["day", "Per hari"], ["hour", "Per jam"], ["month", "Per bulan"]] as [Granularity, string][]).map(([g, label]) => (
                  <button
                    key={g}
                    type="button"
                    className={gran === g ? styles.segOn : ""}
                    onClick={() => setGran(g)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={styles.flabel}>Tipe grafik</span>
              <div className={styles.seg}>
                {([["bar", "Batang"], ["line", "Garis"]] as [ChartType, string][]).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    className={chartType === t ? styles.segOn : ""}
                    onClick={() => setChartType(t)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {!lockedOutletId && outlets.length > 0 && (
              <div className={styles.field}>
                <span className={styles.flabel}>Outlet</span>
                <select className={styles.select} value={outletF} onChange={(e) => setOutletF(e.target.value)}>
                  <option value={ALL}>Semua outlet</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.field}>
              <span className={styles.flabel}>Produk</span>
              <select className={styles.select} value={product} onChange={(e) => setProduct(e.target.value)}>
                <option value={ALL}>Semua produk</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.flabel}>Metode bayar</span>
              <select className={styles.select} value={pay} onChange={(e) => setPay(e.target.value)}>
                <option value={ALL}>Semua metode</option>
                {payOptions.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.flabel}>Channel pesanan</span>
              <select className={styles.select} value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value={ALL}>Semua channel</option>
                {channelOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <button type="button" className={styles.reset} onClick={reset}>Reset</button>
            <button type="button" className={`${styles.reset} ${styles.resetPrimary}`} onClick={exportPDF}>
              ⇣ Export PDF
            </button>
          </div>
        </div>

        {/* SUMMARY KPIs */}
        <div className={styles.note}>
          Ringkasan penjualan <span className={styles.noteSm}>{fset ? "· terfilter" : ""}</span>
        </div>
        <div className={styles.kpis}>
          <Kpi k="Omzet" n={fmt(omzet)} d={`${fmt(perDay)}/hari rata-rata`} />
          <Kpi k="Total pesanan" n={fmtN(orderCount)} d="transaksi" />
          <Kpi k="Item terjual" n={fmtN(itemCount)} d="qty" />
          <Kpi k="Rata-rata order" n={fmt(aov)} d="per pesanan" />
        </div>

        {/* CHART */}
        <div className={styles.chartcard}>
          <div className={styles.chartHeader}>
            <h4>
              {gran === "hour" ? "Tren penjualan per jam"
                : gran === "day" ? "Tren penjualan harian"
                : "Tren penjualan bulanan"}
            </h4>
            <div className={`${styles.charttools} ${styles.mono}`}>
              {bk.length} {gran === "hour" ? "jam" : gran === "day" ? "hari" : "bulan"} · total {fmt(bk.reduce((s, b) => s + b.v, 0))}
            </div>
          </div>
          <TrendChart bk={bk} type={chartType} gran={gran} />
        </div>

        {/* BREAKDOWNS */}
        <div className={styles.grid2} style={{ marginTop: 11 }}>
          <div className={styles.rcard}>
            <h4>Per metode bayar</h4>
            <div className={styles.csub}>Rupiah & jumlah transaksi</div>
            <Bars data={aggByPay(sales, filter.product)} />
          </div>
          <div className={styles.rcard}>
            <h4>Per channel pesanan</h4>
            <div className={styles.csub}>Rupiah & jumlah pesanan</div>
            <Bars data={aggByChannel(sales, filter.product, channelLabelOf)} />
          </div>
        </div>

        {/* CASH RECAP */}
        <div className={styles.note}>
          Rekap kas
          <span className={styles.noteSm}>
            {single ? "— rekap laci kasir untuk tanggal ini" : "— akumulasi seluruh shift pada periode"}
          </span>
        </div>
        <div className={styles.cashcard}>
          <CashRecap sessions={sessions} from={from} to={to} outlet={filter.outlet} single={single} />
        </div>

        {/* PER MENU */}
        <MenuSection
          sales={sales}
          outlets={outlets}
          channelOptions={channelOptions}
          lockedOutletId={lockedOutletId}
          categoryNameOf={categoryNameOf}
          channelLabelOf={channelLabelOf}
        />

        {/* TRANSACTIONS */}
        <div className={styles.note}>
          Daftar transaksi <span className={styles.noteSm}>· {fmtN(sales.length)} transaksi{sales.length > 120 ? ` (menampilkan 120 teratas)` : ""}</span>
        </div>
        <div className={styles.tcard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>No. Pesanan</th>
                <th>Tanggal</th>
                <th>Waktu</th>
                <th>Channel</th>
                <th>Item</th>
                <th>Status</th>
                <th>Metode</th>
                <th className={styles.num}>Total</th>
              </tr>
            </thead>
            <tbody>
              <TxRows sales={sales} channelLabelOf={channelLabelOf} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ k, n, d }: { k: string; n: string; d: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiK}>{k}</div>
      <div className={`${styles.kpiN} ${styles.serif}`}>{n}</div>
      <div className={styles.kpiD}>{d}</div>
    </div>
  );
}

function TrendChart({ bk, type, gran }: { bk: Bucket[]; type: ChartType; gran: Granularity }) {
  if (!bk.length || bk.every((b) => b.v === 0)) {
    return <div className={styles.empty}>Tidak ada penjualan pada periode/filter ini.</div>;
  }
  const W = 860, H = 270, pl = 58, pr = 16, pt = 16, pb = 38;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const rawMax = Math.max(...bk.map((b) => b.v));
  const step = Math.pow(10, Math.floor(Math.log10(rawMax || 1)));
  const niceMax = Math.ceil(rawMax / step) * step || rawMax || 1;
  const y = (v: number) => pt + plotH - (v / niceMax) * plotH;
  const n = bk.length, bw = plotW / n;

  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const gv = (niceMax * i) / 4;
    const yy = y(gv);
    gridLines.push(
      <g key={i}>
        <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="rgba(36,28,21,.08)" />
        <text x={pl - 8} y={yy + 3} textAnchor="end" fontFamily="var(--sales-mono)" fontSize="9" fill="#6E665B">
          {compact(gv)}
        </text>
      </g>,
    );
  }

  const labStep = Math.max(1, Math.ceil(n / (gran === "day" ? Math.min(n, 12) : n)));
  const xLabels = bk.map((b, i) => {
    if (i % labStep !== 0 && n > 14) return null;
    const x = pl + i * bw + bw / 2;
    return (
      <text key={i} x={x} y={H - 14} textAnchor="middle" fontFamily="var(--sales-mono)" fontSize="9" fill="#6E665B">
        {b.label}
      </text>
    );
  });

  let body: React.ReactNode = null;
  if (type === "bar") {
    const w = Math.max(2, Math.min(bw * 0.66, 46));
    body = bk.map((b, i) => {
      const x = pl + i * bw + (bw - w) / 2;
      const h = plotH - (y(b.v) - pt);
      return (
        <rect
          key={i}
          className={styles.barRect}
          x={x.toFixed(1)}
          y={y(b.v).toFixed(1)}
          width={w.toFixed(1)}
          height={Math.max(0, h).toFixed(1)}
          rx="2.5"
          fill="#6E7B4F"
        >
          <title>{`${b.full} — ${fmt(b.v)} · ${b.n} pesanan`}</title>
        </rect>
      );
    });
  } else {
    const pts = bk.map((b, i) => `${(pl + i * bw + bw / 2).toFixed(1)},${y(b.v).toFixed(1)}`).join(" ");
    const area = `${pl + bw / 2},${pt + plotH} ${pts} ${pl + (n - 1) * bw + bw / 2},${pt + plotH}`;
    body = (
      <>
        <polygon points={area} fill="rgba(110,123,79,.12)" />
        <polyline points={pts} fill="none" stroke="#6E7B4F" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {bk.map((b, i) => {
          const x = pl + i * bw + bw / 2;
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y(b.v).toFixed(1)} r={n > 40 ? 2 : 3.4} fill="#6E7B4F">
              <title>{`${b.full} — ${fmt(b.v)} · ${b.n} pesanan`}</title>
            </circle>
          );
        })}
      </>
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={styles.chartSvg} role="img" aria-label="Grafik penjualan">
      {gridLines}
      {body}
      {xLabels}
    </svg>
  );
}

type BarRow = { label: string; v: number; n: number; color?: string };

function aggByPay(sales: SalesOrder[], product: string): BarRow[] {
  const map = new Map<string, { v: number; n: number }>();
  for (const o of sales) {
    const k = (o.payment_method ?? "lain").toUpperCase();
    const e = map.get(k) ?? { v: 0, n: 0 };
    e.v += lineVal(o, product);
    e.n += 1;
    map.set(k, e);
  }
  return [...map.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.v - a.v);
}

function aggByChannel(sales: SalesOrder[], product: string, labelOf: (id: string | null) => string): BarRow[] {
  const map = new Map<string, { v: number; n: number }>();
  for (const o of sales) {
    const k = labelOf(o.order_channel);
    const e = map.get(k) ?? { v: 0, n: 0 };
    e.v += lineVal(o, product);
    e.n += 1;
    map.set(k, e);
  }
  return [...map.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.v - a.v);
}

function Bars({ data }: { data: BarRow[] }) {
  if (data.length === 0) return <div className={styles.empty}>—</div>;
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <>
      {data.map((d) => (
        <div className={styles.bar} key={d.label}>
          <span className={styles.barLab}>{d.label}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(d.v / max * 100).toFixed(1)}%`, background: d.color }} />
          </div>
          <span className={styles.barVal}>{fmt(d.v)}</span>
          <span className={styles.barCt}>{d.n} trx</span>
        </div>
      ))}
    </>
  );
}

function SlotBars({ sales, product }: { sales: SalesOrder[]; product: string }) {
  const data = SLOTS.map((s) => ({ ...s, v: 0, n: 0 }));
  for (const o of sales) {
    const h = new Date(o.created_at).getHours();
    const sl = slotOf(h);
    const d = data.find((x) => x.label === sl.label);
    if (d) {
      d.v += lineVal(o, product);
      d.n += 1;
    }
  }
  return <Bars data={data.map((d) => ({ label: d.label, v: d.v, n: d.n, color: d.color }))} />;
}

function SlotPie({ sales, product }: { sales: SalesOrder[]; product: string }) {
  const data = SLOTS.map((s) => ({ ...s, v: 0, n: 0 }));
  for (const o of sales) {
    const sl = slotOf(new Date(o.created_at).getHours());
    const d = data.find((x) => x.label === sl.label);
    if (d) {
      d.v += lineVal(o, product);
      d.n += 1;
    }
  }
  const total = data.reduce((s, d) => s + d.v, 0);
  if (total === 0) return <div className={styles.slotPie}><div className={styles.empty}>—</div></div>;

  const size = 240, cx = size / 2, cy = size / 2, r = 100;
  let cum = 0;
  const paths: React.ReactNode[] = [];
  for (const d of data) {
    const pct = d.v / total;
    if (pct === 0) continue;
    const a0 = cum * Math.PI * 2 - Math.PI / 2;
    const a1 = (cum + pct) * Math.PI * 2 - Math.PI / 2;
    const large = pct > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    paths.push(
      <path
        key={d.label}
        d={`M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`}
        fill={d.color}
      >
        <title>{`${d.label}: ${(pct * 100).toFixed(1)}%`}</title>
      </path>,
    );
    cum += pct;
  }
  return (
    <div className={styles.slotPie}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ flexShrink: 0 }}>
        {paths}
        <circle cx={cx} cy={cy} r={30} fill="var(--surface)" />
      </svg>
      <div className={styles.slotLegend}>
        {data.filter((d) => d.v > 0).map((d) => (
          <div key={d.label} className={styles.slotLegendRow}>
            <span className={styles.slotLegendChip} style={{ background: d.color }} />
            <span className={styles.slotLegendName}>{d.label.split("(")[0]!.trim()}</span>
            <span className={styles.mono} style={{ fontSize: 10 }}>{((d.v / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashRecap({
  sessions,
  from,
  to,
  outlet,
  single,
}: {
  sessions: SalesCashierSession[];
  from: Date;
  to: Date;
  outlet: string;
  single: boolean;
}) {
  const fromKey = toInput(from);
  const toKey = toInput(to);
  const filtered = sessions.filter((s) => {
    if (s.session_date < fromKey || s.session_date > toKey) return false;
    if (outlet !== ALL && s.outlet_id !== outlet) return false;
    return true;
  });

  if (filtered.length === 0) {
    return <div className={styles.empty} style={{ padding: "16px 0" }}>Tidak ada sesi kasir pada periode ini.</div>;
  }

  if (single && filtered.length === 1) {
    const s = filtered[0]!;
    const expected = s.opening_cash + s.cash_in - s.cash_out + s.cash_sales;
    const actual = s.actual_closing_cash;
    const sel = actual != null ? actual - expected : null;
    const selClass = sel == null || sel === 0 ? styles.selOk : styles.selBad;
    const selTxt = sel == null
      ? "Sesi belum ditutup"
      : `${sel > 0 ? "+ " : sel < 0 ? "− " : ""}${fmt(Math.abs(sel))}`;
    return (
      <>
        <div className={styles.cashrow}>
          <span className={styles.cashLbl}>Modal awal (kas pembuka)</span>
          <span className={styles.cashAmt}>{fmt(s.opening_cash)}</span>
        </div>
        <div className={styles.cashrow}>
          <span className={styles.cashLbl}>
            Kas masuk <small>penjualan tunai + setoran</small>
          </span>
          <span className={`${styles.cashAmt} ${styles.selOk}`}>+ {fmt(s.cash_sales + s.cash_in)}</span>
        </div>
        <div className={styles.cashrow}>
          <span className={styles.cashLbl}>
            Kas keluar <small>pengeluaran operasional</small>
          </span>
          <span className={`${styles.cashAmt} ${styles.selBad}`}>− {fmt(s.cash_out)}</span>
        </div>
        <div className={`${styles.cashrow} ${styles.cashTot} ${styles.cashTotHi}`}>
          <span className={styles.cashLbl}>Kas seharusnya di laci</span>
          <span className={styles.cashAmt}>{fmt(expected)}</span>
        </div>
        <div className={styles.cashrow}>
          <span className={styles.cashLbl}>Kas aktual (dihitung kasir)</span>
          <span className={styles.cashAmt}>{actual != null ? fmt(actual) : "—"}</span>
        </div>
        <div className={`${styles.cashrow} ${styles.cashTot}`}>
          <span className={styles.cashLbl}>Selisih</span>
          <span className={`${styles.cashAmt} ${selClass}`}>{selTxt}</span>
        </div>
      </>
    );
  }

  // Multi-day rollup
  let masuk = 0, masukSales = 0, keluar = 0, sel = 0, withActual = 0;
  for (const s of filtered) {
    masuk += s.cash_in;
    masukSales += s.cash_sales;
    keluar += s.cash_out;
    if (s.actual_closing_cash != null) {
      sel += s.actual_closing_cash - (s.opening_cash + s.cash_in - s.cash_out + s.cash_sales);
      withActual += 1;
    }
  }
  const selClass = sel === 0 ? styles.selOk : styles.selBad;
  const selTxt = `${sel > 0 ? "+ " : sel < 0 ? "− " : ""}${fmt(Math.abs(sel))}`;
  return (
    <>
      <div className={styles.cashrow}>
        <span className={styles.cashLbl}>Jumlah shift / hari</span>
        <span className={styles.cashAmt}>{filtered.length} sesi</span>
      </div>
      <div className={styles.cashrow}>
        <span className={styles.cashLbl}>
          Total kas masuk <small>penjualan tunai</small>
        </span>
        <span className={`${styles.cashAmt} ${styles.selOk}`}>+ {fmt(masukSales)}</span>
      </div>
      <div className={styles.cashrow}>
        <span className={styles.cashLbl}>
          Setoran tambahan <small>top-up & koreksi</small>
        </span>
        <span className={`${styles.cashAmt} ${styles.selOk}`}>+ {fmt(masuk)}</span>
      </div>
      <div className={styles.cashrow}>
        <span className={styles.cashLbl}>
          Total kas keluar <small>pengeluaran operasional</small>
        </span>
        <span className={`${styles.cashAmt} ${styles.selBad}`}>− {fmt(keluar)}</span>
      </div>
      <div className={`${styles.cashrow} ${styles.cashTot} ${styles.cashTotHi}`}>
        <span className={styles.cashLbl}>Arus kas bersih (tunai)</span>
        <span className={styles.cashAmt}>{fmt(masukSales + masuk - keluar)}</span>
      </div>
      <div className={`${styles.cashrow} ${styles.cashTot}`}>
        <span className={styles.cashLbl}>
          Total selisih laci <small>{withActual}/{filtered.length} sesi ditutup</small>
        </span>
        <span className={`${styles.cashAmt} ${selClass}`}>{withActual === 0 ? "—" : selTxt}</span>
      </div>
    </>
  );
}

function MenuSection({
  sales,
  outlets,
  channelOptions,
  lockedOutletId,
  categoryNameOf,
  channelLabelOf,
}: {
  sales: SalesOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
  channelOptions: string[];
  lockedOutletId: string | null;
  categoryNameOf: (id: string | null) => string;
  channelLabelOf: (id: string | null) => string;
}) {
  const [menuOutlet, setMenuOutlet] = useState<string>(ALL);
  const [menuChannel, setMenuChannel] = useState<string>(ALL);

  const filtered = useMemo(() => {
    if (menuOutlet === ALL && menuChannel === ALL) return sales;
    return sales.filter((o) => {
      if (menuOutlet !== ALL && o.outlet_id !== menuOutlet) return false;
      if (menuChannel !== ALL && channelLabelOf(o.order_channel) !== menuChannel) return false;
      return true;
    });
  }, [sales, menuOutlet, menuChannel, channelLabelOf]);

  return (
    <>
      <div className={styles.note}>
        Rekap penjualan per menu <span className={styles.noteSm}>— per item menu, berdasarkan filter aktif</span>
      </div>
      <div className={styles.tcard}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {!lockedOutletId && outlets.length > 0 && (
            <div className={styles.field}>
              <span className={styles.flabel}>Outlet</span>
              <select className={styles.select} value={menuOutlet} onChange={(e) => setMenuOutlet(e.target.value)}>
                <option value={ALL}>Semua outlet</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className={styles.field}>
            <span className={styles.flabel}>Channel</span>
            <select className={styles.select} value={menuChannel} onChange={(e) => setMenuChannel(e.target.value)}>
              <option value={ALL}>Semua channel</option>
              {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Menu</th>
              <th>Kategori</th>
              <th className={styles.num}>Qty terjual</th>
              <th className={styles.num}>Harga menu</th>
              <th className={styles.num}>% Pendapatan</th>
              <th className={styles.num}>Pendapatan (Rp)</th>
              <th className={styles.num}>Rata-rata/pesanan</th>
            </tr>
          </thead>
          <tbody>
            <MenuRows sales={filtered} categoryNameOf={categoryNameOf} />
          </tbody>
        </table>
      </div>
    </>
  );
}

function MenuRows({
  sales,
  categoryNameOf,
}: {
  sales: SalesOrder[];
  categoryNameOf: (id: string | null) => string;
}) {
  const map = new Map<string, { name: string; qty: number; val: number; orders: Set<string>; menuId: string | null; unitPrice: number }>();
  for (const o of sales) {
    for (const it of o.items) {
      const key = it.menu_item_id ?? `__${it.name}`;
      const e = map.get(key) ?? { name: it.name, qty: 0, val: 0, orders: new Set<string>(), menuId: it.menu_item_id, unitPrice: it.price };
      e.qty += it.quantity;
      e.val += it.price * it.quantity;
      e.orders.add(o.id);
      map.set(key, e);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.val - a.val);
  const totalVal = rows.reduce((s, r) => s + r.val, 0);
  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={7} className={styles.empty}>Tidak ada data.</td>
      </tr>
    );
  }
  return (
    <>
      {rows.map((r) => {
        const pct = totalVal ? (r.val / totalVal * 100).toFixed(1) : "0";
        const avg = r.orders.size ? r.val / r.orders.size : 0;
        return (
          <tr key={r.name}>
            <td className={styles.rowname}>{r.name}</td>
            <td style={{ color: "var(--muted)", fontSize: 12 }}>{categoryNameOf(r.menuId)}</td>
            <td className={styles.num}>{fmtN(r.qty)}</td>
            <td className={styles.num}>{fmt(r.unitPrice)}</td>
            <td className={styles.num}>{pct}%</td>
            <td className={styles.num}>{fmt(r.val)}</td>
            <td className={styles.num}>{fmt(avg)}</td>
          </tr>
        );
      })}
    </>
  );
}

function TxRows({
  sales,
  channelLabelOf,
}: {
  sales: SalesOrder[];
  channelLabelOf: (id: string | null) => string;
}) {
  if (sales.length === 0) {
    return (
      <tr>
        <td colSpan={8} className={styles.empty}>Tidak ada transaksi untuk filter ini.</td>
      </tr>
    );
  }
  const list = sales.slice(0, 120);
  return (
    <>
      {list.map((o) => {
        const d = new Date(o.created_at);
        const items = o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ");
        const statusLabel =
          ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status ?? "—";
        return (
          <tr key={o.id}>
            <td className={styles.mono} style={{ fontSize: 11 }}>{o.order_number}</td>
            <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{shortDate(d)}</td>
            <td style={{ color: "var(--muted)" }}>{`${pad(d.getHours())}.${pad(d.getMinutes())}`}</td>
            <td>{channelLabelOf(o.order_channel)}</td>
            <td className={styles.txitems}>{items || "—"}</td>
            <td><span className={styles.paytag}>{statusLabel}</span></td>
            <td><span className={styles.paytag}>{(o.payment_method ?? "—").toUpperCase()}</span></td>
            <td className={styles.num}>{fmt(o.total)}</td>
          </tr>
        );
      })}
    </>
  );
}

function doExport(args: {
  sales: SalesOrder[];
  filter: FilterState;
  gran: Granularity;
  single: boolean;
  days: number;
  omzet: number;
  orderCount: number;
  itemCount: number;
  aov: number;
  perDay: number;
  periodLabel: string;
  outletName: string;
  channelLabelOf: (id: string | null) => string;
  categoryNameOf: (id: string | null) => string;
  menuItems: MenuItem[];
  sessions: SalesCashierSession[];
}) {
  const { sales, filter, days, omzet, orderCount, itemCount, aov, perDay, periodLabel, outletName, channelLabelOf, categoryNameOf, sessions } = args;

  // Cashier sessions in range (mirrors in-app CashRecap filtering)
  const fromKey = toInput(filter.from);
  const toKey = toInput(filter.to);
  const sessionsInRange = sessions.filter((s) => {
    if (s.session_date < fromKey || s.session_date > toKey) return false;
    if (filter.outlet !== ALL && s.outlet_id !== filter.outlet) return false;
    return true;
  });
  let cashSalesSum = 0, cashInSum = 0, cashOutSum = 0, openingSum = 0, actualSum = 0, withActual = 0;
  for (const s of sessionsInRange) {
    cashSalesSum += s.cash_sales;
    cashInSum += s.cash_in;
    cashOutSum += s.cash_out;
    openingSum += s.opening_cash;
    if (s.actual_closing_cash != null) {
      actualSum += s.actual_closing_cash - (s.opening_cash + s.cash_in - s.cash_out + s.cash_sales);
      withActual += 1;
    }
  }
  const netCash = cashSalesSum + cashInSum - cashOutSum;

  // Per shift
  const slotData = SLOTS.map((s) => ({ ...s, v: 0, n: 0 }));
  for (const o of sales) {
    const sl = slotOf(new Date(o.created_at).getHours());
    const d = slotData.find((x) => x.label === sl.label);
    if (d) {
      d.v += lineVal(o, filter.product);
      d.n += 1;
    }
  }

  // Per menu
  const menuMap = new Map<string, { name: string; qty: number; val: number; menuId: string | null; unitPrice: number }>();
  for (const o of sales) {
    for (const it of o.items) {
      const k = it.menu_item_id ?? `__${it.name}`;
      const e = menuMap.get(k) ?? { name: it.name, qty: 0, val: 0, menuId: it.menu_item_id, unitPrice: it.price };
      e.qty += it.quantity;
      e.val += it.price * it.quantity;
      menuMap.set(k, e);
    }
  }
  const menuRows = [...menuMap.values()].sort((a, b) => b.val - a.val);
  const menuTotal = menuRows.reduce((s, r) => s + r.val, 0);

  // Payment + channel breakdowns
  const payRows = aggByPay(sales, filter.product);
  const chanRows = aggByChannel(sales, filter.product, channelLabelOf);
  const payMax = Math.max(...payRows.map((r) => r.v), 1);
  const chanMax = Math.max(...chanRows.map((r) => r.v), 1);

  // Top 5 menu
  const top5 = menuRows.slice(0, 5);

  // Transactions (cap)
  const txCap = 200;
  const txData = sales.slice(0, txCap);

  const filename = `Laporan_Penjualan_${outletName.replace(/\s+/g, "-")}_${toInput(filter.from).replace(/-/g, "")}-${toInput(filter.to).replace(/-/g, "")}.pdf`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup diblokir. Izinkan popup untuk export PDF.");
    return;
  }

  const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(filename)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Inter:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;color:#241C15;line-height:1.5;padding:28px 32px;max-width:800px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #241C15;padding-bottom:14px;margin-bottom:16px}
.brand{font-family:'Fraunces',serif;font-size:20px;font-weight:500}
.brand b{color:#6E7B4F}
.meta{text-align:right;font-size:11px;color:#6E665B;font-family:'Space Mono',monospace}
h1{font-family:'Fraunces',serif;font-weight:400;font-size:22px;margin:0 0 4px}
.period{font-size:13px;color:#6E665B;margin-bottom:16px}
.section{margin-top:20px}
.stitle{font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.05em;text-transform:uppercase;color:#B56A1C;margin-bottom:6px;display:flex;align-items:center;gap:6px}
.stitle::before{content:"";width:14px;height:2px;background:#B56A1C}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.kpi{border:1px solid rgba(36,28,21,.13);border-radius:8px;padding:10px 12px}
.kpi .k{font-size:10px;color:#6E665B}.kpi .n{font-family:'Fraunces',serif;font-size:20px;margin-top:2px}.kpi .d{font-size:10px;color:#6E665B;margin-top:1px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
th{text-align:left;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:.04em;text-transform:uppercase;color:#6E665B;font-weight:400;padding:4px 6px 4px 0;border-bottom:1px solid rgba(36,28,21,.13)}
td{padding:5px 6px 5px 0;border-bottom:1px solid rgba(36,28,21,.06);vertical-align:top}
.num{text-align:right;font-family:'Space Mono',monospace;font-size:11px;white-space:nowrap}
.rowname{font-weight:500}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.card{border:1px solid rgba(36,28,21,.13);border-radius:8px;padding:10px 12px}
.card h4{font-size:12px;font-weight:600;margin-bottom:6px}
.bar-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px}
.bar-row .lab{width:90px;flex-shrink:0;color:#4a4137;font-size:11px}
.bar-row .track{flex:1;height:12px;background:#EDE7D9;border-radius:3px;position:relative;overflow:hidden}
.bar-row .fill{position:absolute;inset:0 auto 0 0;border-radius:3px;background:#6E7B4F}
.bar-row .val{min-width:80px;text-align:right;font-family:'Space Mono',monospace;font-size:10px}
.stamp{font-family:'Space Mono',monospace;font-size:9px;color:#6E665B;text-align:center;margin-top:24px;padding-top:10px;border-top:1px solid rgba(36,28,21,.13)}
@media print{body{padding:20px}@page{margin:16mm 14mm;size:A4}}
.highlight{background:#F7F3EA;border-radius:8px;padding:12px 14px;margin-bottom:12px;display:flex;gap:20px;flex-wrap:wrap}
.highlight .hlabel{font-size:10px;color:#6E665B;text-transform:uppercase;letter-spacing:.04em;font-family:'Space Mono',monospace}
.highlight .hval{font-family:'Fraunces',serif;font-size:26px;letter-spacing:-.01em}
.highlight .hsub{font-size:11px;color:#6E665B}
.pbreak{page-break-before:always}
.txitems{font-size:10px;color:#6E665B;line-height:1.3;max-width:200px}
.paytag{font-size:9px;background:#EDE7D9;padding:1px 6px;border-radius:4px;white-space:nowrap}
</style></head><body>
<div class="header">
  <div><div class="brand">solusi<b>saji</b></div><div style="font-size:11px;color:#6E665B;margin-top:2px">Laporan Penjualan</div></div>
  <div class="meta">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}<br>${escapeHtml(outletName)}</div>
</div>

<h1>Laporan Penjualan</h1>
<div class="period">${escapeHtml(periodLabel)}</div>

<div class="highlight">
  <div style="flex:1;min-width:160px"><div class="hlabel">Total Omzet</div><div class="hval">${fmt(omzet)}</div><div class="hsub">${fmtN(orderCount)} pesanan · ${fmtN(itemCount)} item</div></div>
  <div style="flex:1;min-width:120px"><div class="hlabel">Rata-rata/hari</div><div class="hval">${fmt(perDay)}</div><div class="hsub">${days} hari periode</div></div>
  <div style="flex:1;min-width:120px"><div class="hlabel">Rata-rata/pesanan</div><div class="hval">${fmt(aov)}</div><div class="hsub">average order value</div></div>
</div>

${sessionsInRange.length > 0 ? `
<div class="section"><div class="stitle">Ringkasan Kasir</div>
<table><tbody>
<tr><td>Jumlah sesi kasir</td><td class="num">${sessionsInRange.length} sesi</td></tr>
<tr><td>Modal awal (kas pembuka)</td><td class="num">${fmt(openingSum)}</td></tr>
<tr><td>Kas masuk <span style="color:#6E665B;font-size:10px">penjualan tunai</span></td><td class="num" style="color:#1e8c66">+ ${fmt(cashSalesSum)}</td></tr>
<tr><td>Setoran tambahan <span style="color:#6E665B;font-size:10px">top-up & koreksi</span></td><td class="num" style="color:#1e8c66">+ ${fmt(cashInSum)}</td></tr>
<tr><td>Kas keluar <span style="color:#6E665B;font-size:10px">pengeluaran operasional</span></td><td class="num" style="color:#a8392b">− ${fmt(cashOutSum)}</td></tr>
<tr><td style="font-weight:600">Arus kas bersih (tunai)</td><td class="num" style="font-weight:600">${fmt(netCash)}</td></tr>
<tr><td>Total selisih laci <span style="color:#6E665B;font-size:10px">${withActual}/${sessionsInRange.length} sesi ditutup</span></td><td class="num" style="color:${actualSum === 0 ? "#1e8c66" : "#a8392b"}">${withActual === 0 ? "—" : `${actualSum > 0 ? "+ " : actualSum < 0 ? "− " : ""}${fmt(Math.abs(actualSum))}`}</td></tr>
</tbody></table></div>
` : ""}

<div class="section"><div class="stitle">Top 5 Menu Terlaris</div>
<table><thead><tr><th>Menu</th><th class="num">Qty</th><th class="num">Pendapatan</th><th class="num">%</th></tr></thead><tbody>
${top5.map((r) => `<tr><td class="rowname">${escapeHtml(r.name)}</td><td class="num">${fmtN(r.qty)}</td><td class="num">${fmt(r.val)}</td><td class="num">${menuTotal ? (r.val / menuTotal * 100).toFixed(1) : "0"}%</td></tr>`).join("")}
</tbody></table></div>

<div class="section"><div class="stitle">Penjualan per Kelompok Jam</div>
<table><thead><tr><th>Shift</th><th class="num">Omzet</th><th class="num">Pesanan</th><th class="num">%</th></tr></thead><tbody>
${slotData.map((d) => `<tr><td>${escapeHtml(d.label)}</td><td class="num">${fmt(d.v)}</td><td class="num">${d.n}</td><td class="num">${omzet ? (d.v / omzet * 100).toFixed(1) : "0"}%</td></tr>`).join("")}
</tbody></table></div>

<div class="section duo"><div class="card"><h4>Per Metode Bayar</h4>
${payRows.map((r) => `<div class="bar-row"><span class="lab">${escapeHtml(r.label)}</span><div class="track"><div class="fill" style="width:${(r.v / payMax * 100).toFixed(1)}%"></div></div><span class="val">${fmt(r.v)} · ${r.n}</span></div>`).join("") || '<div style="font-size:11px;color:#6E665B">—</div>'}
</div><div class="card"><h4>Per Channel</h4>
${chanRows.map((r) => `<div class="bar-row"><span class="lab">${escapeHtml(r.label)}</span><div class="track"><div class="fill" style="width:${(r.v / chanMax * 100).toFixed(1)}%"></div></div><span class="val">${fmt(r.v)} · ${r.n}</span></div>`).join("") || '<div style="font-size:11px;color:#6E665B">—</div>'}
</div></div>

<div class="pbreak"></div>

<div class="section"><div class="stitle">Rekap Penjualan per Menu</div>
<table><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Qty</th><th class="num">Harga menu</th><th class="num">%</th><th class="num">Pendapatan</th></tr></thead><tbody>
${menuRows.map((r) => `<tr><td class="rowname">${escapeHtml(r.name)}</td><td style="color:#6E665B;font-size:11px">${escapeHtml(categoryNameOf(r.menuId))}</td><td class="num">${fmtN(r.qty)}</td><td class="num">${fmt(r.unitPrice)}</td><td class="num">${menuTotal ? (r.val / menuTotal * 100).toFixed(1) : "0"}%</td><td class="num">${fmt(r.val)}</td></tr>`).join("")}
</tbody></table></div>

<div class="section"><div class="stitle">Daftar Transaksi${sales.length > txCap ? ` (${txCap} dari ${fmtN(sales.length)})` : ""}</div>
<table style="font-size:11px"><thead><tr><th>No. Pesanan</th><th>Tanggal</th><th>Waktu</th><th>Channel</th><th>Item</th><th>Status</th><th>Metode</th><th class="num">Total</th></tr></thead><tbody>
${txData.map((o) => {
    const d = new Date(o.created_at);
    const items = o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ");
    const statusLabel = ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status ?? "—";
    return `<tr><td style="font-family:'Space Mono';font-size:10px">${escapeHtml(o.order_number)}</td><td style="color:#6E665B;white-space:nowrap">${shortDate(d)}</td><td style="color:#6E665B">${pad(d.getHours())}.${pad(d.getMinutes())}</td><td>${escapeHtml(channelLabelOf(o.order_channel))}</td><td class="txitems">${escapeHtml(items || "—")}</td><td><span class="paytag">${escapeHtml(statusLabel)}</span></td><td><span class="paytag">${escapeHtml((o.payment_method ?? "—").toUpperCase())}</span></td><td class="num">${fmt(o.total)}</td></tr>`;
  }).join("")}
</tbody></table></div>

<div class="stamp">SOLUSI SAJI · Dokumen ini dihasilkan otomatis oleh sistem.</div>

<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

"use client";

import { useMemo, useState } from "react";
import { ORDER_CHANNEL_LABEL } from "@/lib/types";
import type { MenuCategory, MenuItem, OrderChannelConfig, Outlet } from "@/lib/types";
import type { OwnerOrder } from "./page";
import styles from "./ringkasan.module.css";

type Granularity = "day" | "month";
type ChartType = "bar" | "line";
type Preset = "today" | "7d" | "30d" | "thismonth" | "lastmonth" | "all" | "custom";

const ALL = "ALL";

const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MON_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const SLOTS = [
  { label: "Pagi", range: "07–11", from: 7, to: 10, color: "#A7AE86" },
  { label: "Siang", range: "11–14", from: 11, to: 13, color: "#6E7B4F" },
  { label: "Sore", range: "14–17", from: 14, to: 16, color: "#454E2F" },
  { label: "Malam", range: "17–22", from: 17, to: 23, color: "#241C15" },
] as const;

function pad(n: number): string { return String(n).padStart(2, "0"); }
function fmt(n: number): string { return `Rp ${Math.round(n).toLocaleString("id-ID")}`; }
function fmtN(n: number): string { return Math.round(n).toLocaleString("id-ID"); }
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
function shortDate(d: Date): string { return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
function prettyDate(d: Date): string { return `${DOW_SHORT[d.getDay()]}, ${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}`; }
function slotOf(h: number) { for (const s of SLOTS) if (h >= s.from && h <= s.to) return s; return SLOTS[3]; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

type Enriched = {
  order: OwnerOrder;
  gross: number;
  cogs: number;
  commission: number;
  contrib: number;
  itemCount: number;
};

function enrich(
  orders: OwnerOrder[],
  costByMenu: Map<string, number>,
  commissionByChannelId: Map<string, number>,
  commissionByChannelName: Map<string, number>,
): Enriched[] {
  return orders.map((o) => {
    let cogs = 0;
    let itemCount = 0;
    for (const it of o.items) {
      itemCount += it.quantity;
      const c = it.menu_item_id ? costByMenu.get(it.menu_item_id) ?? 0 : 0;
      cogs += c * it.quantity;
    }
    const channelKey = o.order_channel ?? "";
    const rate =
      commissionByChannelId.get(channelKey)
      ?? commissionByChannelName.get(channelKey.toLowerCase())
      ?? 0;
    const commission = o.total * rate;
    const contrib = o.total - cogs - commission;
    return { order: o, gross: o.total, cogs, commission, contrib, itemCount };
  });
}

type FilterState = {
  from: Date;
  to: Date;
  outlet: string;
  channel: string;
};

function passSales(e: Enriched, f: FilterState, channelLabelOf: (id: string | null) => string): boolean {
  const t = new Date(e.order.created_at).getTime();
  const fromT = f.from.getTime();
  const toT = new Date(f.to).setHours(23, 59, 59, 999);
  if (t < fromT || t > toT) return false;
  if (e.order.payment_status !== "paid") return false;
  if (f.outlet !== ALL && e.order.outlet_id !== f.outlet) return false;
  if (f.channel !== ALL && channelLabelOf(e.order.order_channel) !== f.channel) return false;
  return true;
}

type Bucket = { key: string; label: string; full: string; g: number; c: number; n: number };

function buckets(sales: Enriched[], gran: Granularity, from: Date, to: Date): Bucket[] {
  if (gran === "day") {
    const map = new Map<string, { g: number; c: number; n: number; d: Date }>();
    let d = new Date(from);
    while (d <= to) {
      const k = toInput(d);
      map.set(k, { g: 0, c: 0, n: 0, d: new Date(d) });
      d = addDays(d, 1);
    }
    for (const e of sales) {
      const k = toInput(new Date(e.order.created_at));
      const b = map.get(k);
      if (b) { b.g += e.gross; b.c += e.contrib; b.n += 1; }
    }
    return [...map.entries()].map(([k, o]) => ({
      key: k,
      label: shortDate(o.d),
      full: prettyDate(o.d),
      g: o.g,
      c: o.c,
      n: o.n,
    }));
  }
  const map = new Map<string, { g: number; c: number; n: number }>();
  for (const e of sales) {
    const ts = new Date(e.order.created_at);
    const k = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}`;
    const cur = map.get(k) ?? { g: 0, c: 0, n: 0 };
    cur.g += e.gross;
    cur.c += e.contrib;
    cur.n += 1;
    map.set(k, cur);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, o]) => {
    const m = Number(k.slice(5, 7));
    return {
      key: k,
      label: `${MON_SHORT[m - 1]} ${k.slice(2, 4)}`,
      full: `${MON_FULL[m - 1]} ${k.slice(0, 4)}`,
      g: o.g,
      c: o.c,
      n: o.n,
    };
  });
}

export function RingkasanBisnis({
  orders,
  outlets,
  channels,
  categories,
  menuItems,
}: {
  orders: OwnerOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
  channels: OrderChannelConfig[];
  categories: MenuCategory[];
  menuItems: MenuItem[];
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

  const costByMenu = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of menuItems) m.set(it.id, it.cost_price ?? 0);
    return m;
  }, [menuItems]);

  const commissionByChannelId = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of channels) m.set(c.id, c.commission_rate ?? 0);
    return m;
  }, [channels]);

  const commissionByChannelName = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of channels) m.set(c.name.toLowerCase(), c.commission_rate ?? 0);
    return m;
  }, [channels]);

  const enriched = useMemo(
    () => enrich(orders, costByMenu, commissionByChannelId, commissionByChannelName),
    [orders, costByMenu, commissionByChannelId, commissionByChannelName],
  );

  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState<Date>(() => addDays(today, -29));
  const [to, setTo] = useState<Date>(today);
  const [gran, setGran] = useState<Granularity>("day");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [outletF, setOutletF] = useState<string>(ALL);
  const [channelF, setChannelF] = useState<string>(ALL);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "today") { setFrom(today); setTo(today); }
    else if (p === "7d") { setFrom(addDays(today, -6)); setTo(today); }
    else if (p === "30d") { setFrom(addDays(today, -29)); setTo(today); }
    else if (p === "thismonth") { setFrom(startOfMonth(today)); setTo(today); }
    else if (p === "lastmonth") {
      const last = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      setFrom(last);
      setTo(endOfMonth(last));
    } else if (p === "all") {
      // Use the earliest order date in the dataset, fallback to 120 days back.
      let earliest = today;
      for (const o of orders) {
        const d = new Date(o.created_at);
        d.setHours(0, 0, 0, 0);
        if (d < earliest) earliest = d;
      }
      setFrom(earliest);
      setTo(today);
    }
  }

  function reset() {
    setOutletF(ALL);
    setChannelF(ALL);
    setGran("day");
    setChartType("bar");
    applyPreset("30d");
  }

  const filter: FilterState = useMemo(
    () => ({ from, to, outlet: outletF, channel: channelF }),
    [from, to, outletF, channelF],
  );

  const sales = useMemo(
    () => enriched.filter((e) => passSales(e, filter, channelLabelOf)),
    [enriched, filter, channelLabelOf],
  );

  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const omzet = sales.reduce((s, o) => s + o.gross, 0);
  const cogs = sales.reduce((s, o) => s + o.cogs, 0);
  const komisi = sales.reduce((s, o) => s + o.commission, 0);
  const contrib = sales.reduce((s, o) => s + o.contrib, 0);
  const itemCount = sales.reduce((s, o) => s + o.itemCount, 0);
  const orderCount = sales.length;
  const aov = orderCount > 0 ? omzet / orderCount : 0;
  const perDay = days > 0 ? omzet / days : 0;
  const margin = omzet > 0 ? contrib / omzet : 0;

  const bk = useMemo(() => buckets(sales, gran, from, to), [sales, gran, from, to]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) set.add(channelLabelOf(o.order_channel));
    return [...set].sort();
  }, [orders, channelLabelOf]);

  // Streams = rows grouped by outlet name
  const streams = useMemo(() => {
    const map = new Map<string, { gross: number; cogs: number; commission: number; contrib: number; n: number; qty: number; isFest: boolean }>();
    const fest = (name: string | null) => !!name && /festival|popup|pop-up/i.test(name);
    for (const e of sales) {
      const name = e.order.outlet_name ?? "Lain-lain";
      const cur = map.get(name) ?? { gross: 0, cogs: 0, commission: 0, contrib: 0, n: 0, qty: 0, isFest: fest(name) };
      cur.gross += e.gross;
      cur.cogs += e.cogs;
      cur.commission += e.commission;
      cur.contrib += e.contrib;
      cur.n += 1;
      cur.qty += e.itemCount;
      map.set(name, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.gross - a.gross);
  }, [sales]);

  // Channel economics: gross & contrib per channel
  const byChannel = useMemo(() => {
    const map = new Map<string, { gross: number; contrib: number; n: number; isAggregator: boolean }>();
    for (const e of sales) {
      const label = channelLabelOf(e.order.order_channel);
      const id = e.order.order_channel;
      const isAggregator = id ? (commissionByChannelId.get(id) ?? 0) > 0 : false;
      const cur = map.get(label) ?? { gross: 0, contrib: 0, n: 0, isAggregator };
      cur.gross += e.gross;
      cur.contrib += e.contrib;
      cur.n += 1;
      map.set(label, cur);
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.gross - a.gross);
  }, [sales, channelLabelOf, commissionByChannelId]);

  // Per menu top-8 by gross
  const byMenu = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; gross: number; cogs: number; menuId: string | null }>();
    for (const e of sales) {
      for (const it of e.order.items) {
        const key = it.menu_item_id ?? `__${it.name}`;
        const cost = it.menu_item_id ? (costByMenu.get(it.menu_item_id) ?? 0) : 0;
        const cur = map.get(key) ?? { name: it.name, qty: 0, gross: 0, cogs: 0, menuId: it.menu_item_id };
        cur.qty += it.quantity;
        cur.gross += it.price * it.quantity;
        cur.cogs += cost * it.quantity;
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.gross - a.gross).slice(0, 8);
  }, [sales, costByMenu]);

  const daypartData = useMemo(() => {
    const data = SLOTS.map((s) => ({ ...s, v: 0, n: 0 }));
    for (const e of sales) {
      const h = new Date(e.order.created_at).getHours();
      const sl = slotOf(h);
      const row = data.find((x) => x.label === sl.label);
      if (row) { row.v += e.gross; row.n += 1; }
    }
    return data;
  }, [sales]);

  const actions = useMemo(() => buildActions({ streams, byChannel, byMenu, omzet, margin }), [streams, byChannel, byMenu, omzet, margin]);

  const fset = outletF !== ALL || channelF !== ALL;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.mast}>
          <div className={styles.brand}>solusi<b>saji</b></div>
          <div className={styles.ctx}>
            <span className={styles.role}>Pemilik · Owner</span>
            <span className={styles.lock}>
              {outlets.length} outlet{outlets.length === 1 ? "" : ""}
            </span>
          </div>
        </div>
      </header>

      <div className={styles.wrap}>
        <div className={`${styles.h1} ${styles.serif}`}>Ringkasan Bisnis</div>
        <p className={styles.sub}>
          Konsolidasi seluruh outlet — omzet, biaya, profit kontribusi.
        </p>

        {/* FILTER CARD */}
        <div className={styles.filtercard}>
          <div className={styles.frow}>
            <div>
              <span className={styles.flabel}>Periode</span>
              <div className={styles.presets}>
                {([
                  ["today", "Hari ini"],
                  ["7d", "7 hari"],
                  ["30d", "30 hari"],
                  ["thismonth", "Bulan ini"],
                  ["lastmonth", "Bulan lalu"],
                  ["all", "Semua"],
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
                <input type="date" className={styles.input} value={toInput(from)}
                  onChange={(e) => { if (!e.target.value) return; setPreset("custom"); setFrom(fromInput(e.target.value)); }} />
              </div>
              <div className={styles.field}>
                <span className={styles.flabel}>Sampai</span>
                <input type="date" className={styles.input} value={toInput(to)}
                  onChange={(e) => { if (!e.target.value) return; setPreset("custom"); setTo(fromInput(e.target.value)); }} />
              </div>
            </div>
            <div className={styles.activelabel}>
              <b>{toInput(from) === toInput(to) ? prettyDate(from) : `${shortDate(from)} – ${shortDate(to)}`}</b> · {days} hari
            </div>
          </div>

          <div className={styles.frow}>
            <div>
              <span className={styles.flabel}>Kelompok grafik</span>
              <div className={styles.seg}>
                {([["day", "Per hari"], ["month", "Per bulan"]] as [Granularity, string][]).map(([g, label]) => (
                  <button key={g} type="button" className={gran === g ? styles.segOn : ""} onClick={() => setGran(g)}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <span className={styles.flabel}>Tipe grafik</span>
              <div className={styles.seg}>
                {([["bar", "Batang"], ["line", "Garis"]] as [ChartType, string][]).map(([t, label]) => (
                  <button key={t} type="button" className={chartType === t ? styles.segOn : ""} onClick={() => setChartType(t)}>{label}</button>
                ))}
              </div>
            </div>
            <div className={styles.field}>
              <span className={styles.flabel}>Outlet</span>
              <select className={styles.select} value={outletF} onChange={(e) => setOutletF(e.target.value)}>
                <option value={ALL}>Semua outlet</option>
                {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.flabel}>Channel</span>
              <select className={styles.select} value={channelF} onChange={(e) => setChannelF(e.target.value)}>
                <option value={ALL}>Semua channel</option>
                {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" className={styles.reset} onClick={reset}>Reset</button>
          </div>
        </div>

        {/* KPIs */}
        <div className={styles.note}>
          Ringkasan keuangan <span className={styles.noteSm}>{fset ? "· terfilter" : ""}</span>
        </div>
        <div className={`${styles.kpis} ${styles.kpisC6}`}>
          <Kpi k="Omzet kotor" n={fmt(omzet)} d={`${fmt(perDay)}/hari`} />
          <Kpi k="Profit kontribusi" n={fmt(contrib)} d={`margin ${(margin * 100).toFixed(1)}%`} variant="profit" />
          <Kpi k="Komisi aplikasi" n={fmt(komisi)} d={`${omzet ? (komisi / omzet * 100).toFixed(1) : 0}% omzet`} variant="leak" />
          <Kpi k="HPP" n={fmt(cogs)} d={`${omzet ? (cogs / omzet * 100).toFixed(1) : 0}% omzet`} />
          <Kpi k="Total pesanan" n={fmtN(orderCount)} d="transaksi" />
          <Kpi k="Rata-rata order" n={fmt(aov)} d="per pesanan" />
        </div>

        {/* CHART */}
        <div className={styles.chartcard}>
          <div className={styles.chartHeader}>
            <h4>{gran === "day" ? "Tren penjualan harian" : "Tren penjualan bulanan"}</h4>
            <div className={`${styles.charttools} ${styles.mono}`}>
              {bk.length} {gran === "day" ? "hari" : "bulan"} · omzet {fmt(omzet)} · profit {fmt(contrib)}
            </div>
          </div>
          <TrendChart bk={bk} type={chartType} />
        </div>

        {/* STREAMS TABLE */}
        <div className={styles.note}>Rincian per sumber pendapatan <span className={styles.noteSm}>— per outlet</span></div>
        <div className={styles.tcard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sumber</th>
                <th className={styles.num}>Pesanan</th>
                <th className={styles.num}>Item</th>
                <th className={styles.num}>Omzet</th>
                <th className={styles.num}>HPP</th>
                <th className={styles.num}>Komisi</th>
                <th className={styles.num}>Profit</th>
                <th className={styles.num}>Margin</th>
                <th className={styles.num}>AOV</th>
              </tr>
            </thead>
            <tbody>
              {streams.length === 0 ? (
                <tr><td colSpan={9} className={styles.empty}>Tidak ada data.</td></tr>
              ) : (
                <>
                  {streams.map((s) => {
                    const m = s.gross > 0 ? s.contrib / s.gross : 0;
                    const a = s.n > 0 ? s.gross / s.n : 0;
                    return (
                      <tr key={s.name}>
                        <td className={styles.rowname}>{s.name}</td>
                        <td className={styles.num}>{fmtN(s.n)}</td>
                        <td className={styles.num}>{fmtN(s.qty)}</td>
                        <td className={styles.num}>{fmt(s.gross)}</td>
                        <td className={styles.num}>{fmt(s.cogs)}</td>
                        <td className={styles.num}>{fmt(s.commission)}</td>
                        <td className={styles.num}>{fmt(s.contrib)}</td>
                        <td className={styles.num}>{(m * 100).toFixed(1)}%</td>
                        <td className={styles.num}>{fmt(a)}</td>
                      </tr>
                    );
                  })}
                  <tr className={styles.trTotal}>
                    <td>Total</td>
                    <td className={styles.num}>{fmtN(orderCount)}</td>
                    <td className={styles.num}>{fmtN(itemCount)}</td>
                    <td className={styles.num}>{fmt(omzet)}</td>
                    <td className={styles.num}>{fmt(cogs)}</td>
                    <td className={styles.num}>{fmt(komisi)}</td>
                    <td className={styles.num}>{fmt(contrib)}</td>
                    <td className={styles.num}>{(margin * 100).toFixed(1)}%</td>
                    <td className={styles.num}>{fmt(aov)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* CROSS-OUTLET COMPARISON */}
        <div className={styles.note}>Perbandingan efisiensi antar sumber</div>
        <ComparisonCards streams={streams} />

        {/* CHANNEL ECONOMICS + PER MENU */}
        <div className={styles.note}>Ekonomi per channel <span className={styles.noteSm}>— omzet vs profit</span></div>
        <div className={styles.grid2}>
          <div className={styles.rcard}>
            <h4>Pendapatan per channel</h4>
            <div className={styles.csub}>Bar terang = omzet · bar tegas = profit kontribusi</div>
            <ChannelDualBars data={byChannel} />
            <div className={styles.bleg}>
              <span><i style={{ background: "var(--profit)" }} />Direct (margin tinggi)</span>
              <span><i style={{ background: "var(--leak)" }} />Aplikasi (komisi tinggi)</span>
            </div>
          </div>
          <div className={styles.rcard}>
            <h4>Rekap per menu</h4>
            <div className={styles.csub}>Top 8 berdasarkan omzet · margin per item</div>
            <MenuBars data={byMenu} categoryNameOf={categoryNameOf} />
          </div>
        </div>

        {/* DAYPART */}
        <div className={styles.note}>Rekap per kelompok jam</div>
        <div className={styles.rcard} style={{ marginTop: 0 }}>
          <DaypartBars data={daypartData} total={omzet} />
        </div>

        {/* ACTIONS */}
        <div className={styles.note}>Aksi prioritas <span className={styles.noteSm}>— diurutkan berdasarkan dampak rupiah</span></div>
        {actions.length === 0 ? (
          <div className={styles.empty}>Belum ada rekomendasi. Data masih sedikit atau semuanya sudah optimal.</div>
        ) : (
          actions.map((a, i) => (
            <div key={i} className={styles.action}>
              <span className={styles.actionBadge}>{a.tag}</span>
              <div>
                <div className={styles.actionTxt} dangerouslySetInnerHTML={{ __html: a.text }} />
                {a.impact && <div className={styles.actionImp}>{a.impact}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Small render helpers
// ============================================================================

function Kpi({ k, n, d, variant }: { k: string; n: string; d: string; variant?: "profit" | "leak" | "fest" }) {
  const cls = variant === "profit" ? styles.kpiProfit : variant === "leak" ? styles.kpiLeak : variant === "fest" ? styles.kpiFest : "";
  return (
    <div className={`${styles.kpi} ${cls}`}>
      <div className={styles.kpiK}>{k}</div>
      <div className={`${styles.kpiN} ${styles.serif}`}>{n}</div>
      <div className={styles.kpiD}>{d}</div>
    </div>
  );
}

function TrendChart({ bk, type }: { bk: Bucket[]; type: ChartType }) {
  if (!bk.length || bk.every((b) => b.g === 0)) {
    return <div className={styles.empty}>Tidak ada penjualan pada periode/filter ini.</div>;
  }
  const W = 900, H = 270, pl = 58, pr = 16, pt = 16, pb = 38;
  const plotW = W - pl - pr, plotH = H - pt - pb;
  const rawMax = Math.max(...bk.map((b) => b.g), 1);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMax = Math.ceil(rawMax / step) * step || rawMax;
  const y = (v: number) => pt + plotH - (v / niceMax) * plotH;
  const n = bk.length, bw = plotW / n;

  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const gv = (niceMax * i) / 4;
    const yy = y(gv);
    grid.push(
      <g key={i}>
        <line x1={pl} y1={yy} x2={W - pr} y2={yy} stroke="rgba(36,28,21,.08)" />
        <text x={pl - 8} y={yy + 3} textAnchor="end" fontFamily="var(--sales-mono)" fontSize="9" fill="#6E665B">{compact(gv)}</text>
      </g>,
    );
  }
  const labStep = Math.max(1, Math.ceil(n / 14));
  const xLabels = bk.map((b, i) => {
    if (i % labStep !== 0 && n > 14) return null;
    const x = pl + i * bw + bw / 2;
    return <text key={i} x={x} y={H - 14} textAnchor="middle" fontFamily="var(--sales-mono)" fontSize="9" fill="#6E665B">{b.label}</text>;
  });
  let body: React.ReactNode = null;
  if (type === "bar") {
    const w = Math.max(2, Math.min(bw * 0.66, 46));
    body = bk.map((b, i) => {
      const x = pl + i * bw + (bw - w) / 2;
      const h = plotH - (y(b.g) - pt);
      return (
        <rect
          key={i}
          className={styles.barRect}
          x={x.toFixed(1)}
          y={y(b.g).toFixed(1)}
          width={w.toFixed(1)}
          height={Math.max(0, h).toFixed(1)}
          rx="2.5"
          fill="#6E7B4F"
        >
          <title>{`${b.full} — omzet ${fmt(b.g)} · profit ${fmt(b.c)} · ${b.n} pesanan`}</title>
        </rect>
      );
    });
  } else {
    const pts = bk.map((b, i) => `${(pl + i * bw + bw / 2).toFixed(1)},${y(b.g).toFixed(1)}`).join(" ");
    const area = `${pl + bw / 2},${pt + plotH} ${pts} ${pl + (n - 1) * bw + bw / 2},${pt + plotH}`;
    body = (
      <>
        <polygon points={area} fill="rgba(110,123,79,.12)" />
        <polyline points={pts} fill="none" stroke="#6E7B4F" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {bk.map((b, i) => {
          const x = pl + i * bw + bw / 2;
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y(b.g).toFixed(1)} r={n > 40 ? 2 : 3.4} fill="#6E7B4F">
              <title>{`${b.full} — omzet ${fmt(b.g)} · profit ${fmt(b.c)} · ${b.n} pesanan`}</title>
            </circle>
          );
        })}
      </>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className={styles.chartSvg} role="img" aria-label="Grafik tren">
      {grid}
      {body}
      {xLabels}
    </svg>
  );
}

function ComparisonCards({ streams }: { streams: Array<{ name: string; gross: number; contrib: number; n: number; qty: number; isFest: boolean }> }) {
  if (streams.length === 0) return null;
  // Top-4
  const top = streams.slice(0, 4);
  const bestMargin = Math.max(...top.map((s) => (s.gross > 0 ? s.contrib / s.gross : 0)));
  return (
    <div className={styles.cmp}>
      {top.map((s) => {
        const m = s.gross > 0 ? s.contrib / s.gross : 0;
        const aov = s.n > 0 ? s.gross / s.n : 0;
        const isBest = m === bestMargin && top.length > 1;
        return (
          <div key={s.name} className={`${styles.cmpCol} ${s.isFest ? styles.cmpColFest : ""}`}>
            <div className={styles.cmpNm}>{s.name}</div>
            <div className={styles.cmpMetric}>
              <div className={styles.cmpMl}>OMZET</div>
              <div className={`${styles.cmpMv} ${styles.serif}`}>{fmt(s.gross)}</div>
            </div>
            <div className={styles.cmpMetric}>
              <div className={styles.cmpMl}>PROFIT</div>
              <div className={`${styles.cmpMv} ${styles.serif}`}>{fmt(s.contrib)}</div>
            </div>
            <div className={styles.cmpMetric}>
              <div className={styles.cmpMl}>MARGIN</div>
              <div className={`${styles.cmpMv} ${styles.serif} ${isBest ? styles.cmpBest : ""}`}>
                {(m * 100).toFixed(1)}%
              </div>
            </div>
            <div className={styles.cmpMetric}>
              <div className={styles.cmpMl}>AOV</div>
              <div className={`${styles.cmpMv} ${styles.serif}`}>{fmt(aov)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChannelDualBars({ data }: { data: Array<{ name: string; gross: number; contrib: number; n: number; isAggregator: boolean }> }) {
  if (data.length === 0) return <div className={styles.empty}>—</div>;
  const max = Math.max(...data.map((d) => d.gross), 1);
  return (
    <>
      {data.map((d) => {
        const grossPct = (d.gross / max) * 100;
        const contribPct = (Math.max(0, d.contrib) / max) * 100;
        const fillCls = d.isAggregator ? styles.fillLeak : styles.fillGood;
        return (
          <div key={d.name} className={styles.bar}>
            <span className={styles.barLab}>{d.name}</span>
            <div className={styles.barTrack}>
              <div className={styles.barGross} style={{ width: `${grossPct.toFixed(1)}%` }} />
              <div className={`${styles.barFill} ${fillCls}`} style={{ width: `${contribPct.toFixed(1)}%` }} />
            </div>
            <span className={styles.barVal}>{fmt(d.gross)}</span>
            <span className={styles.barCt}>{d.n} trx</span>
          </div>
        );
      })}
    </>
  );
}

function MenuBars({
  data,
  categoryNameOf,
}: {
  data: Array<{ name: string; qty: number; gross: number; cogs: number; menuId: string | null }>;
  categoryNameOf: (id: string | null) => string;
}) {
  if (data.length === 0) return <div className={styles.empty}>—</div>;
  const max = Math.max(...data.map((d) => d.gross), 1);
  return (
    <>
      {data.map((d) => {
        const margin = d.gross > 0 ? (d.gross - d.cogs) / d.gross : 0;
        const fillCls = margin >= 0.5 ? styles.fillGood : margin >= 0.3 ? styles.fillSage : styles.fillLeak;
        return (
          <div key={d.name} className={styles.bar}>
            <span className={styles.barLab}>{d.name}</span>
            <div className={styles.barTrack}>
              <div className={`${styles.barFill} ${fillCls}`} style={{ width: `${(d.gross / max * 100).toFixed(1)}%` }} />
            </div>
            <span className={styles.barVal}>{fmt(d.gross)}</span>
            <span className={styles.barCt}>{(margin * 100).toFixed(0)}%</span>
          </div>
        );
      })}
      <div className={styles.bleg}>
        <span><i style={{ background: "var(--profit)" }} />≥ 50% margin</span>
        <span><i style={{ background: "var(--sage)" }} />30–50%</span>
        <span><i style={{ background: "var(--leak)" }} />&lt; 30%</span>
      </div>
      <div style={{ display: "none" }}>{categoryNameOf(null)}</div>
    </>
  );
}

function DaypartBars({ data, total }: { data: Array<{ label: string; range: string; v: number; n: number; color: string }>; total: number }) {
  const max = Math.max(...data.map((d) => d.v), 1);
  return (
    <>
      {data.map((d) => {
        const pct = total > 0 ? (d.v / total) * 100 : 0;
        return (
          <div key={d.label} className={styles.dp}>
            <div className={styles.dpLab}>
              {d.label}
              <small>{d.range}</small>
            </div>
            <div className={styles.dpTrack}>
              <div className={styles.dpFill} style={{ width: `${(d.v / max * 100).toFixed(1)}%`, background: d.color }} />
            </div>
            <span className={styles.dpVal}>{fmt(d.v)}</span>
            <span className={styles.dpCt}>{d.n} trx</span>
            <span className={styles.dpPct}>{pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </>
  );
}

// ============================================================================
// Actions ranker — surfaces concrete recommendations based on the filtered data
// ============================================================================

type Action = { tag: string; text: string; impact: string };

function buildActions(args: {
  streams: Array<{ name: string; gross: number; contrib: number; n: number }>;
  byChannel: Array<{ name: string; gross: number; contrib: number; n: number; isAggregator: boolean }>;
  byMenu: Array<{ name: string; gross: number; cogs: number; qty: number }>;
  omzet: number;
  margin: number;
}): Action[] {
  const out: Action[] = [];
  const { streams, byChannel, byMenu, omzet, margin } = args;
  if (omzet === 0) return out;

  // 1. Biggest profit-leak channel (aggregator with high gross + low margin).
  const aggregators = byChannel.filter((c) => c.isAggregator).sort((a, b) => b.gross - a.gross);
  if (aggregators.length > 0) {
    const a = aggregators[0]!;
    const m = a.gross > 0 ? a.contrib / a.gross : 0;
    if (m < margin && a.gross > omzet * 0.1) {
      const lost = Math.round(a.gross * (margin - m));
      out.push({
        tag: "Channel",
        text: `Channel <b>${escapeHtml(a.name)}</b> menyumbang omzet besar tapi margin <b>${(m * 100).toFixed(1)}%</b> (di bawah rata-rata ${(margin * 100).toFixed(1)}%).`,
        impact: `≈ ${fmt(lost)} potensi profit hilang. Pertimbangkan markup khusus channel ini atau dorong order direct.`,
      });
    }
  }

  // 2. Best-performing stream
  if (streams.length > 1) {
    const best = streams.reduce((acc, s) => {
      const m = s.gross > 0 ? s.contrib / s.gross : 0;
      const am = acc.gross > 0 ? acc.contrib / acc.gross : 0;
      return m > am ? s : acc;
    }, streams[0]!);
    const bm = best.gross > 0 ? best.contrib / best.gross : 0;
    out.push({
      tag: "Outlet",
      text: `<b>${escapeHtml(best.name)}</b> punya margin terbaik <b>${(bm * 100).toFixed(1)}%</b>.`,
      impact: "Pelajari operasinya untuk diterapkan di outlet lain.",
    });
  }

  // 3. Menu items with low / negative margin
  const lowMarginMenu = byMenu
    .map((m) => ({ ...m, mgn: m.gross > 0 ? (m.gross - m.cogs) / m.gross : 0 }))
    .filter((m) => m.gross > 0 && m.mgn < 0.3)
    .sort((a, b) => b.gross - a.gross);
  if (lowMarginMenu.length > 0) {
    const m = lowMarginMenu[0]!;
    out.push({
      tag: "Menu",
      text: `<b>${escapeHtml(m.name)}</b> laris (omzet ${fmt(m.gross)}) tapi margin tipis <b>${(m.mgn * 100).toFixed(0)}%</b>.`,
      impact: `Naikkan harga, tinjau HPP, atau ganti komposisi untuk menambah ≈ ${fmt(m.gross * 0.05)} profit per ${(m.gross / Math.max(1, m.qty) / 1000).toFixed(0)}rb omzet.`,
    });
  }

  // 4. Best daypart-style hint via stream concentration (skip if streams=1)
  if (streams.length > 1) {
    const dominant = streams[0]!;
    const share = dominant.gross / omzet;
    if (share > 0.6) {
      out.push({
        tag: "Risiko",
        text: `<b>${escapeHtml(dominant.name)}</b> menyumbang <b>${(share * 100).toFixed(0)}%</b> omzet — konsentrasi tinggi di satu outlet.`,
        impact: "Diversifikasi sumber pendapatan untuk mengurangi risiko.",
      });
    }
  }

  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

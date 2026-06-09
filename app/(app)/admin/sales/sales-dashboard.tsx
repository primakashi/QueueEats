"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  ChevronDown,
  Download,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatIDR } from "@/lib/format";
import { ORDER_CHANNEL_LABEL, ORDER_CHANNELS, PAYMENT_DESTINATIONS } from "@/lib/types";
import type { Outlet } from "@/lib/types";
import type { SalesOrder } from "./page";

const COLOR_PRIMARY = "#6366f1";
const COLOR_EMERALD = "#10b981";
const COLOR_AMBER = "#f59e0b";
const OUTLET_COLORS = [COLOR_PRIMARY, COLOR_EMERALD, COLOR_AMBER, "#ef4444", "#8b5cf6"];

type Granularity = "day" | "week" | "month" | "hour";

function toInputDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseInputDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(input: Date, diff: number): Date {
  const d = new Date(input);
  d.setDate(d.getDate() + diff);
  return d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatShortIDR(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(Math.round(value));
}

function safeInputDate(s: string, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  return parseInputDate(s);
}

type TooltipItem = { name?: string; value?: number; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      {label !== undefined && <div className="font-medium mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name ?? ""}</span>
          <span className="font-medium tabular-nums">
            {formatter && typeof p.value === "number" ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const activeCount = selected.size;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-9 gap-1.5" />}>
        <span>{label}</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="rounded-full px-1.5 text-xs">
            {activeCount}
          </Badge>
        )}
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.has(opt.value)}
            onCheckedChange={() => onToggle(opt.value)}
            closeOnClick={false}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function filterOrders(
  orders: SalesOrder[],
  opts: {
    dateFrom: Date;
    dateTo: Date;
    granularity: Granularity;
    hourDay?: Date;
    outlets: Set<string>;
    channels: Set<string>;
    paymentMethods: Set<string>;
    destinations: Set<string>;
    statusFilter: "all" | "paid";
  },
): SalesOrder[] {
  const fromMs = new Date(opts.dateFrom).setHours(0, 0, 0, 0);
  const toMs = opts.granularity === "hour" && opts.hourDay
    ? new Date(opts.hourDay).setHours(23, 59, 59, 999)
    : new Date(opts.dateTo).setHours(23, 59, 59, 999);

  return orders.filter((o) => {
    const t = new Date(o.created_at).getTime();
    if (t < fromMs || t > toMs) return false;

    if (opts.granularity === "hour" && opts.hourDay) {
      const d = new Date(o.created_at);
      const hd = opts.hourDay;
      if (
        d.getFullYear() !== hd.getFullYear() ||
        d.getMonth() !== hd.getMonth() ||
        d.getDate() !== hd.getDate()
      ) return false;
    }

    if (opts.outlets.size > 0) {
      if (!o.outlet_id || !opts.outlets.has(o.outlet_id)) return false;
    }
    if (opts.channels.size > 0) {
      const ch = o.order_channel ?? "direct";
      if (!opts.channels.has(ch)) return false;
    }
    if (opts.paymentMethods.size > 0) {
      const pm = o.payment_method ?? "";
      if (!opts.paymentMethods.has(pm)) return false;
    }
    if (opts.destinations.size > 0) {
      const dest = o.payment_destination ?? "";
      if (!opts.destinations.has(dest)) return false;
    }
    if (opts.statusFilter === "paid" && o.payment_status !== "paid") return false;
    return true;
  });
}

type ChartRow = { label: string; revenue: number; orders: number; full: string };

function aggregateByDay(orders: SalesOrder[]): ChartRow[] {
  const map = new Map<string, { revenue: number; orders: number; label: string }>();
  for (const o of orders) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const short = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    const full = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const cur = map.get(key);
    if (cur) {
      cur.revenue += o.total;
      cur.orders += 1;
    } else {
      map.set(key, { revenue: o.total, orders: 1, label: short });
    }
    const entry = map.get(key)!;
    entry.label = short;
    void full;
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const d = parseInputDate(key);
      return {
        label: v.label,
        revenue: v.revenue,
        orders: v.orders,
        full: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
      };
    });
}

function aggregateByHour(orders: SalesOrder[]): ChartRow[] {
  const map = new Map<number, { revenue: number; orders: number }>();
  for (const o of orders) {
    const h = new Date(o.created_at).getHours();
    const cur = map.get(h);
    if (cur) { cur.revenue += o.total; cur.orders += 1; }
    else map.set(h, { revenue: o.total, orders: 1 });
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, v]) => ({
      label: `${pad2(h)}:00`,
      revenue: v.revenue,
      orders: v.orders,
      full: `${pad2(h)}:00 - ${pad2((h + 1) % 24)}:00`,
    }));
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return { year: date.getUTCFullYear(), week: Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) };
}

function aggregateByWeek(orders: SalesOrder[]): ChartRow[] {
  const map = new Map<string, { revenue: number; orders: number; label: string; full: string }>();
  for (const o of orders) {
    const d = new Date(o.created_at);
    const { year, week } = getISOWeek(d);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const cur = map.get(key);
    if (cur) { cur.revenue += o.total; cur.orders += 1; }
    else map.set(key, { revenue: o.total, orders: 1, label: `W${week}`, full: `Minggu ${week}, ${year}` });
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => ({ label: v.label, revenue: v.revenue, orders: v.orders, full: v.full }));
}

function aggregateByMonth(orders: SalesOrder[]): ChartRow[] {
  const map = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    const d = new Date(o.created_at);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const cur = map.get(key);
    if (cur) { cur.revenue += o.total; cur.orders += 1; }
    else map.set(key, { revenue: o.total, orders: 1 });
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => {
      const [y, m] = key.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      const label = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      const full = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      return { label, revenue: v.revenue, orders: v.orders, full };
    });
}

function aggregateBestSellers(orders: SalesOrder[]): { name: string; qty: number; revenue: number }[] {
  const map = new Map<string, { qty: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.name);
      if (cur) { cur.qty += it.quantity; cur.revenue += it.price * it.quantity; }
      else map.set(it.name, { qty: it.quantity, revenue: it.price * it.quantity });
    }
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.qty - a.qty);
}

function outletShare(orders: SalesOrder[], outlets: Pick<Outlet, "id" | "name">[]): { name: string; value: number }[] {
  const outletMap = new Map(outlets.map((o) => [o.id, o.name]));
  const map = new Map<string, number>();
  for (const o of orders) {
    const name = o.outlet_name ?? outletMap.get(o.outlet_id ?? "") ?? "Tidak diketahui";
    map.set(name, (map.get(name) ?? 0) + o.total);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function SalesDashboard({
  orders,
  outlets,
  initialOutlet,
}: {
  orders: SalesOrder[];
  outlets: Pick<Outlet, "id" | "name">[];
  initialOutlet?: string;
}) {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => addDays(today, -13), [today]);

  const [granularity, setGranularity] = useState<Granularity>("day");
  const [dateFromStr, setDateFromStr] = useState(() => toInputDateValue(defaultStart));
  const [dateToStr, setDateToStr] = useState(() => toInputDateValue(today));
  const [hourDayStr, setHourDayStr] = useState(() => toInputDateValue(today));
  const [statusFilter, setStatusFilter] = useState<"all" | "paid">("paid");

  const [selectedOutlets, setSelectedOutlets] = useState<Set<string>>(
    () => initialOutlet ? new Set([initialOutlet]) : new Set(),
  );
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set());
  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(new Set());

  function toggleFilter(set: Set<string>, value: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  function applyPreset(days: number) {
    setGranularity("day");
    setDateFromStr(toInputDateValue(addDays(today, -(days - 1))));
    setDateToStr(toInputDateValue(today));
  }

  const filtered = useMemo(() => {
    const hourDay = safeInputDate(hourDayStr, today);
    const dateFrom = granularity === "hour" ? hourDay : safeInputDate(dateFromStr, defaultStart);
    const dateTo = granularity === "hour" ? hourDay : safeInputDate(dateToStr, today);
    return filterOrders(orders, {
      dateFrom,
      dateTo,
      granularity,
      hourDay: granularity === "hour" ? hourDay : undefined,
      outlets: selectedOutlets,
      channels: selectedChannels,
      paymentMethods: selectedMethods,
      destinations: selectedDestinations,
      statusFilter,
    });
  }, [orders, granularity, dateFromStr, dateToStr, hourDayStr, selectedOutlets, selectedChannels, selectedMethods, selectedDestinations, statusFilter, today, defaultStart]);

  const totals = useMemo(() => ({
    revenue: filtered.reduce((s, o) => s + o.total, 0),
    orders: filtered.length,
  }), [filtered]);

  const averageTicket = totals.orders > 0 ? totals.revenue / totals.orders : 0;

  const chartData = useMemo(() => {
    if (granularity === "hour") return aggregateByHour(filtered);
    if (granularity === "week") return aggregateByWeek(filtered);
    if (granularity === "month") return aggregateByMonth(filtered);
    return aggregateByDay(filtered);
  }, [filtered, granularity]);

  const bestSellers = useMemo(() => aggregateBestSellers(filtered), [filtered]);

  const outletShareData = useMemo(() => outletShare(filtered, outlets), [filtered, outlets]);

  const outletOptions = useMemo(() =>
    outlets.map((o) => ({ value: o.id, label: o.name })),
    [outlets],
  );
  const channelOptions = ORDER_CHANNELS.map((ch) => ({ value: ch, label: ORDER_CHANNEL_LABEL[ch] }));
  const methodOptions = [
    { value: "qris", label: "QRIS" },
    { value: "cash", label: "Tunai" },
  ];
  const destinationOptions = PAYMENT_DESTINATIONS.map((d) => ({ value: d, label: d }));

  const tableOrders = useMemo(() =>
    [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [filtered],
  );

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const sheetRows = tableOrders.map((o) => ({
      "No. Pesanan": o.order_number,
      Waktu: new Date(o.created_at).toLocaleString("id-ID"),
      Outlet: o.outlet_name ?? "-",
      Channel: ORDER_CHANNEL_LABEL[(o.order_channel as keyof typeof ORDER_CHANNEL_LABEL) ?? "direct"] ?? o.order_channel ?? "-",
      "Metode Bayar": o.payment_method ?? "-",
      "Tujuan Bayar": o.payment_destination ?? "-",
      Status: o.payment_status,
      Total: o.total,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan");
    XLSX.writeFile(wb, `penjualan-${toInputDateValue(new Date())}.xlsx`);
  }

  const hasActiveFilters =
    selectedOutlets.size > 0 ||
    selectedChannels.size > 0 ||
    selectedMethods.size > 0 ||
    selectedDestinations.size > 0;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="space-y-1.5">
            <Label>Kelompok</Label>
            <div className="flex gap-1 flex-wrap">
              {([["day","Per hari"],["week","Per minggu"],["month","Per bulan"],["hour","Per jam"]] as [Granularity, string][]).map(([g, label]) => (
                <Button key={g} size="sm" variant={granularity === g ? "default" : "outline"} onClick={() => setGranularity(g)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {granularity === "hour" ? (
            <div className="space-y-1.5">
              <Label htmlFor="sales-hour-day">Tanggal</Label>
              <Input id="sales-hour-day" type="date" value={hourDayStr} onChange={(e) => setHourDayStr(e.target.value)} className="w-40" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sales-from">Dari</Label>
                <Input id="sales-from" type="date" value={dateFromStr} onChange={(e) => setDateFromStr(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sales-to">Sampai</Label>
                <Input id="sales-to" type="date" value={dateToStr} onChange={(e) => setDateToStr(e.target.value)} className="w-40" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 lg:ml-auto flex-wrap">
            <Button size="sm" variant="outline" onClick={() => applyPreset(1)}>Hari ini</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(7)}>7 hari</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(30)}>30 hari</Button>
            <Button
              size="sm"
              variant={statusFilter === "paid" ? "default" : "outline"}
              onClick={() => setStatusFilter(s => s === "paid" ? "all" : "paid")}
            >
              {statusFilter === "paid" ? "Lunas saja" : "Semua status"}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={downloadExcel}>
              <Download className="size-4 mr-1" /> Excel
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground font-medium">Filter sumber:</span>
          {outletOptions.length > 0 && (
            <MultiSelectFilter
              label="Outlet"
              options={outletOptions}
              selected={selectedOutlets}
              onToggle={(v) => toggleFilter(selectedOutlets, v, setSelectedOutlets)}
            />
          )}
          <MultiSelectFilter
            label="Channel"
            options={channelOptions}
            selected={selectedChannels}
            onToggle={(v) => toggleFilter(selectedChannels, v, setSelectedChannels)}
          />
          <MultiSelectFilter
            label="Metode bayar"
            options={methodOptions}
            selected={selectedMethods}
            onToggle={(v) => toggleFilter(selectedMethods, v, setSelectedMethods)}
          />
          <MultiSelectFilter
            label="Tujuan bayar"
            options={destinationOptions}
            selected={selectedDestinations}
            onToggle={(v) => toggleFilter(selectedDestinations, v, setSelectedDestinations)}
          />
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-9"
              onClick={() => {
                setSelectedOutlets(new Set());
                setSelectedChannels(new Set());
                setSelectedMethods(new Set());
                setSelectedDestinations(new Set());
              }}
            >
              Hapus semua filter
            </Button>
          )}
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4 gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="size-4" /> Total pendapatan
          </div>
          <div className="text-2xl font-semibold">{formatIDR(totals.revenue)}</div>
          <div className="text-xs text-muted-foreground">{totals.orders} transaksi</div>
        </Card>
        <Card className="p-4 gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShoppingBag className="size-4" /> Total pesanan
          </div>
          <div className="text-2xl font-semibold tabular-nums">{totals.orders.toLocaleString("id-ID")}</div>
        </Card>
        <Card className="p-4 gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-4" /> Rata-rata nilai order
          </div>
          <div className="text-2xl font-semibold">{formatIDR(Math.round(averageTicket))}</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <div className="font-medium mb-1">Tren pendapatan</div>
          <p className="text-xs text-muted-foreground mb-4">
            {{ day: "Per hari", week: "Per minggu", month: "Per bulan", hour: "Per jam" }[granularity]} · {totals.orders} pesanan
          </p>
          {chartData.length === 0 ? (
            <div className="h-64 grid place-items-center text-sm text-muted-foreground">
              Tidak ada data untuk filter ini.
            </div>
          ) : (
            <div className="h-64 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_PRIMARY} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={COLOR_PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => formatShortIDR(v)} />
                  <Tooltip cursor={{ stroke: COLOR_PRIMARY, strokeOpacity: 0.3 }} content={<ChartTooltip formatter={(v) => formatIDR(Math.round(v))} />} />
                  <Area type="monotone" dataKey="revenue" name="Pendapatan" stroke={COLOR_PRIMARY} strokeWidth={2.25} fill="url(#g-revenue)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="font-medium mb-1">Komposisi per outlet</div>
          <p className="text-xs text-muted-foreground mb-2">Berdasarkan filter aktif.</p>
          {outletShareData.length === 0 ? (
            <div className="h-56 grid place-items-center text-sm text-muted-foreground">
              Tidak ada data outlet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outletShareData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} isAnimationActive={false}>
                    {outletShareData.map((_, i) => (
                      <Cell key={i} fill={OUTLET_COLORS[i % OUTLET_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip formatter={(v) => formatIDR(Math.round(v))} />} />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Bar charts for channel and payment destination */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="p-4">
          <div className="font-medium mb-1">Pendapatan per channel</div>
          <ChannelBar orders={filtered} />
        </Card>
        <Card className="p-4">
          <div className="font-medium mb-1">Pendapatan per tujuan pembayaran</div>
          <DestinationBar orders={filtered} />
        </Card>
      </div>

      {/* Best sellers */}
      {bestSellers.length > 0 && (
        <Card className="p-4">
          <div className="font-medium mb-1">Produk terlaris</div>
          <p className="text-xs text-muted-foreground mb-4">Berdasarkan filter aktif · {bestSellers.reduce((s, i) => s + i.qty, 0)} item terjual</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium w-8">#</th>
                  <th className="pb-2 pr-4 font-medium">Produk</th>
                  <th className="pb-2 pr-4 font-medium text-right">Qty terjual</th>
                  <th className="pb-2 font-medium text-right">Pendapatan</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.slice(0, 10).map((item, i) => (
                  <tr key={item.name} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{item.qty.toLocaleString("id-ID")}</td>
                    <td className="py-2 text-right tabular-nums">{formatIDR(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Transaction table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <div className="font-medium">Rincian transaksi</div>
          <p className="text-xs text-muted-foreground">{tableOrders.length} pesanan cocok dengan filter</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Pesanan</TableHead>
              <TableHead>Waktu</TableHead>
              <TableHead>Outlet</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Tujuan Bayar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Tidak ada transaksi untuk filter ini.
                </TableCell>
              </TableRow>
            ) : (
              tableOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-sm">{o.outlet_name ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="text-sm">
                    {ORDER_CHANNEL_LABEL[(o.order_channel as keyof typeof ORDER_CHANNEL_LABEL) ?? "direct"] ?? o.order_channel ?? "-"}
                  </TableCell>
                  <TableCell className="text-sm">{o.payment_destination ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    <Badge variant={o.payment_status === "paid" ? "default" : "outline"} className="text-xs">
                      {o.payment_status === "paid" ? "Lunas" : o.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatIDR(o.total)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {tableOrders.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={6} className="font-medium">Total ({tableOrders.length} transaksi)</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatIDR(totals.revenue)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}

function ChannelBar({ orders }: { orders: SalesOrder[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const ch = ORDER_CHANNEL_LABEL[(o.order_channel as keyof typeof ORDER_CHANNEL_LABEL) ?? "direct"] ?? o.order_channel ?? "Langsung";
      map.set(ch, (map.get(ch) ?? 0) + o.total);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  if (data.length === 0) {
    return <div className="h-48 grid place-items-center text-sm text-muted-foreground">Tidak ada data.</div>;
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data].reverse()} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.08} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatShortIDR(v)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.85 }} axisLine={false} tickLine={false} width={100} />
          <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.05 }} content={<ChartTooltip formatter={(v) => formatIDR(Math.round(v))} />} />
          <Bar dataKey="value" name="Pendapatan" fill={COLOR_EMERALD} radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DestinationBar({ orders }: { orders: SalesOrder[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      const dest = o.payment_destination ?? "Tidak ditentukan";
      map.set(dest, (map.get(dest) ?? 0) + o.total);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [orders]);

  if (data.length === 0) {
    return <div className="h-48 grid place-items-center text-sm text-muted-foreground">Tidak ada data.</div>;
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[...data].reverse()} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" strokeOpacity={0.08} />
          <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatShortIDR(v)} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.85 }} axisLine={false} tickLine={false} width={130} />
          <Tooltip cursor={{ fill: "currentColor", fillOpacity: 0.05 }} content={<ChartTooltip formatter={(v) => formatIDR(Math.round(v))} />} />
          <Bar dataKey="value" name="Pendapatan" fill={COLOR_AMBER} radius={[0, 6, 6, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

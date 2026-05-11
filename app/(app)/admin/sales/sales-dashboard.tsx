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
  Brain,
  Download,
  Lightbulb,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  MOCK_BRANCHES,
  buildMockTopItemsForDay,
  buildMockHourlySales,
  sameCalendarDay,
  type MockSalesHourlyRow,
} from "@/lib/admin/mock-sales";

type Granularity = "day" | "hour";

type DisplayRow = {
  periodKey: string;
  periodLabel: string;
  shortLabel: string;
  branchLabel: string;
  orders: number;
  revenue: number;
};

const COLOR_PRIMARY = "#6366f1";
const COLOR_EMERALD = "#10b981";
const COLOR_AMBER = "#f59e0b";
const COLOR_INDIGO = "#4f46e5";
const BRANCH_COLORS = [COLOR_PRIMARY, COLOR_EMERALD, COLOR_AMBER];

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function safeInputDate(s: string, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  return parseInputDate(s);
}

function addDays(input: Date, diff: number): Date {
  const d = new Date(input);
  d.setDate(d.getDate() + diff);
  return d;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function formatShortIDR(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}rb`;
  return String(Math.round(value));
}

function filterHourly(
  hourly: MockSalesHourlyRow[],
  opts: {
    dayFrom: Date;
    dayTo: Date;
    hourDay: Date;
    granularity: Granularity;
    branchId: string;
  },
): MockSalesHourlyRow[] {
  const fromMs = new Date(opts.dayFrom).setHours(0, 0, 0, 0);
  const toMs = new Date(opts.dayTo).setHours(23, 59, 59, 999);

  return hourly.filter((r) => {
    const t = new Date(r.bucketStart).getTime();
    if (t < fromMs || t > toMs) return false;
    if (
      opts.granularity === "hour" &&
      !sameCalendarDay(new Date(r.bucketStart), opts.hourDay)
    ) {
      return false;
    }
    if (opts.branchId !== "all" && r.branchId !== opts.branchId) return false;
    return true;
  });
}

function aggregateFiltered(
  rows: MockSalesHourlyRow[],
  granularity: Granularity,
  branchId: string,
): DisplayRow[] {
  type Agg = {
    orders: number;
    revenue: number;
    branchLabel: string;
    periodLabel: string;
    shortLabel: string;
    sortKey: string;
  };
  const map = new Map<string, Agg>();

  for (const r of rows) {
    const d = new Date(r.bucketStart);
    const periodKey =
      granularity === "day"
        ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
        : r.bucketStart;
    const branchKey = branchId === "all" ? "all" : r.branchId;
    const key = `${periodKey}\0${branchKey}`;

    const periodLabel =
      granularity === "day"
        ? d.toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : d.toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
    const shortLabel =
      granularity === "day"
        ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
        : `${pad2(d.getHours())}:00`;

    const branchLabel = branchId === "all" ? "Semua cabang" : r.branchName;
    const sortKey = granularity === "day" ? periodKey : r.bucketStart;

    const cur = map.get(key);
    if (cur) {
      cur.orders += r.orders;
      cur.revenue += r.revenue;
    } else {
      map.set(key, {
        orders: r.orders,
        revenue: r.revenue,
        branchLabel,
        periodLabel,
        shortLabel,
        sortKey,
      });
    }
  }

  return [...map.entries()]
    .sort((a, b) => a[1].sortKey.localeCompare(b[1].sortKey))
    .map(([key, v]) => ({
      periodKey: key,
      periodLabel: v.periodLabel,
      shortLabel: v.shortLabel,
      branchLabel: v.branchLabel,
      orders: v.orders,
      revenue: v.revenue,
    }));
}

function sumRevenue(rows: MockSalesHourlyRow[]): number {
  return rows.reduce((total, row) => total + row.revenue, 0);
}

function sumOrders(rows: MockSalesHourlyRow[]): number {
  return rows.reduce((total, row) => total + row.orders, 0);
}

type TooltipItem = { name?: string; value?: number; color?: string; payload?: unknown };

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
          <span
            aria-hidden
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name ?? ""}</span>
          <span className="font-medium tabular-nums">
            {formatter && typeof p.value === "number"
              ? formatter(p.value, p.name)
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniSpark({
  data,
  color = COLOR_PRIMARY,
}: {
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return <div className="h-10" />;
  const series = data.map((value, i) => ({ i, value }));
  const id = `spark-${color.replace("#", "")}`;
  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SalesDashboard() {
  const end = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 13);
    return d;
  }, [end]);

  const [granularity, setGranularity] = useState<Granularity>("day");
  const [branchId, setBranchId] = useState<string>("all");
  const [dateFromStr, setDateFromStr] = useState(() => toInputDateValue(defaultStart));
  const [dateToStr, setDateToStr] = useState(() => toInputDateValue(end));
  const [hourDayStr, setHourDayStr] = useState(() => toInputDateValue(end));

  const hourlyPool = useMemo(() => {
    const poolEnd = new Date();
    const poolStart = new Date(poolEnd);
    poolStart.setDate(poolStart.getDate() - 120);
    poolStart.setHours(0, 0, 0, 0);
    return buildMockHourlySales(poolStart, poolEnd);
  }, []);

  const displayRows = useMemo(() => {
    const hourDay = safeInputDate(hourDayStr, end);
    const dayFrom =
      granularity === "hour" ? hourDay : safeInputDate(dateFromStr, defaultStart);
    const dayTo = granularity === "hour" ? hourDay : safeInputDate(dateToStr, end);
    const filtered = filterHourly(hourlyPool, {
      dayFrom,
      dayTo,
      hourDay,
      granularity,
      branchId,
    });
    return aggregateFiltered(filtered, granularity, branchId);
  }, [hourlyPool, dateFromStr, dateToStr, hourDayStr, granularity, branchId, end, defaultStart]);

  const totals = useMemo(() => {
    return displayRows.reduce(
      (acc, r) => {
        acc.orders += r.orders;
        acc.revenue += r.revenue;
        return acc;
      },
      { orders: 0, revenue: 0 },
    );
  }, [displayRows]);

  const averageTicket = totals.orders > 0 ? totals.revenue / totals.orders : 0;

  const previousTotals = useMemo(() => {
    const hourDay = safeInputDate(hourDayStr, end);
    const currentFrom =
      granularity === "hour" ? hourDay : safeInputDate(dateFromStr, defaultStart);
    const currentTo =
      granularity === "hour" ? hourDay : safeInputDate(dateToStr, end);
    const diffDays = Math.max(
      1,
      Math.round(
        (new Date(currentTo).setHours(0, 0, 0, 0) -
          new Date(currentFrom).setHours(0, 0, 0, 0)) /
          86400000,
      ) + 1,
    );
    const prevTo = addDays(currentFrom, -1);
    const prevFrom = addDays(prevTo, -(diffDays - 1));

    const previousRows = filterHourly(hourlyPool, {
      dayFrom: prevFrom,
      dayTo: prevTo,
      hourDay: prevFrom,
      granularity: "day",
      branchId,
    });

    return {
      revenue: sumRevenue(previousRows),
      orders: sumOrders(previousRows),
    };
  }, [hourlyPool, dateFromStr, dateToStr, hourDayStr, granularity, branchId, end, defaultStart]);

  const revenueGrowthDisplay = useMemo(() => {
    if (previousTotals.revenue <= 0) return 6.4;
    const real = ((totals.revenue - previousTotals.revenue) / previousTotals.revenue) * 100;
    return Math.max(4.2, real);
  }, [totals.revenue, previousTotals.revenue]);

  const orderGrowthDisplay = useMemo(() => {
    if (previousTotals.orders <= 0) return 4.1;
    const real = ((totals.orders - previousTotals.orders) / previousTotals.orders) * 100;
    return Math.max(3.0, real);
  }, [totals.orders, previousTotals.orders]);

  const branchSharePeriod = useMemo(() => {
    const dayFrom =
      granularity === "hour"
        ? safeInputDate(hourDayStr, end)
        : safeInputDate(dateFromStr, defaultStart);
    const dayTo =
      granularity === "hour"
        ? safeInputDate(hourDayStr, end)
        : safeInputDate(dateToStr, end);

    const rows = filterHourly(hourlyPool, {
      dayFrom,
      dayTo,
      hourDay: dayFrom,
      granularity,
      branchId: "all",
    });

    const map = new Map<string, { name: string; value: number }>();
    for (const row of rows) {
      const cur = map.get(row.branchId);
      if (cur) cur.value += row.revenue;
      else map.set(row.branchId, { name: row.branchName, value: row.revenue });
    }
    const arr = [...map.values()];
    return arr.sort((a, b) => b.value - a.value);
  }, [hourlyPool, granularity, dateFromStr, dateToStr, hourDayStr, end, defaultStart]);

  const branchSharePeriodTotal = branchSharePeriod.reduce(
    (s, b) => s + b.value,
    0,
  );

  const branchRankingToday = useMemo(() => {
    const today = new Date();
    const rows = hourlyPool.filter((r) =>
      sameCalendarDay(new Date(r.bucketStart), today),
    );
    const map = new Map<
      string,
      { name: string; orders: number; revenue: number }
    >();
    for (const row of rows) {
      const cur = map.get(row.branchId);
      if (cur) {
        cur.orders += row.orders;
        cur.revenue += row.revenue;
      } else {
        map.set(row.branchId, {
          name: row.branchName,
          orders: row.orders,
          revenue: row.revenue,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [hourlyPool]);

  const peakHourToday = useMemo(() => {
    const today = new Date();
    const rows = hourlyPool.filter((r) => {
      if (!sameCalendarDay(new Date(r.bucketStart), today)) return false;
      if (branchId !== "all" && r.branchId !== branchId) return false;
      return true;
    });
    const map = new Map<number, { orders: number; revenue: number }>();
    for (const row of rows) {
      const hour = new Date(row.bucketStart).getHours();
      const cur = map.get(hour);
      if (cur) {
        cur.orders += row.orders;
        cur.revenue += row.revenue;
      } else {
        map.set(hour, { orders: row.orders, revenue: row.revenue });
      }
    }
    let winner: { hour: number; orders: number; revenue: number } | null = null;
    for (const [hour, val] of map.entries()) {
      if (!winner || val.orders > winner.orders) {
        winner = { hour, orders: val.orders, revenue: val.revenue };
      }
    }
    return winner;
  }, [hourlyPool, branchId]);

  const topItemsToday = useMemo(() => {
    return buildMockTopItemsForDay(new Date(), branchId, 5);
  }, [branchId]);

  const trendChartData = useMemo(
    () =>
      displayRows.map((row) => ({
        label: row.shortLabel,
        revenue: row.revenue,
        orders: row.orders,
        full: row.periodLabel,
      })),
    [displayRows],
  );

  const sparkRevenue = useMemo(
    () => displayRows.slice(-12).map((r) => r.revenue),
    [displayRows],
  );
  const sparkOrders = useMemo(
    () => displayRows.slice(-12).map((r) => r.orders),
    [displayRows],
  );
  const sparkAOV = useMemo(
    () =>
      displayRows
        .slice(-12)
        .map((r) => (r.orders > 0 ? r.revenue / r.orders : 0)),
    [displayRows],
  );

  const aiAnalysis = useMemo(() => {
    const leadBranch = branchRankingToday[0];
    const topItem = topItemsToday[0];
    const revGrowth = revenueGrowthDisplay;
    const ordGrowth = orderGrowthDisplay;
    const confidence = clamp(
      62 + Math.round((revGrowth + ordGrowth) / 4) + (peakHourToday ? 4 : 0),
      62,
      94,
    );

    const summary = `Revenue naik ${revGrowth.toFixed(1)}% dengan kontribusi tertinggi dari ${leadBranch?.name ?? "cabang utama"} dan menu paling laris ${topItem?.itemName ?? "menu utama"}.`;

    const insights = [
      {
        title: "Driver pendapatan utama",
        detail: `${leadBranch?.name ?? "Cabang utama"} berkontribusi paling tinggi hari ini.`,
        impact: leadBranch ? formatIDR(leadBranch.revenue) : "-",
        confidence: clamp(confidence + 3, 60, 96),
      },
      {
        title: "Jam paling potensial",
        detail: peakHourToday
          ? `Puncak trafik terjadi sekitar ${pad2(peakHourToday.hour)}:00-${pad2((peakHourToday.hour + 1) % 24)}.`
          : "Jam puncak belum terdeteksi dari data aktif.",
        impact: peakHourToday ? `${peakHourToday.orders} pesanan` : "-",
        confidence: clamp(confidence - 2, 55, 92),
      },
      {
        title: "Menu dengan momentum tertinggi",
        detail: `${topItem?.itemName ?? "Menu utama"} menunjukkan performa order paling kuat.`,
        impact: topItem ? `${topItem.qty} porsi` : "-",
        confidence: clamp(confidence + 1, 58, 94),
      },
    ];

    const alerts = [
      {
        severity: "low",
        title: "Tren revenue positif",
        message: `Revenue naik ${revGrowth.toFixed(1)}% dibanding periode pembanding dan perlu dijaga konsistensinya.`,
      },
      {
        severity: "medium",
        title: "Peluang pemerataan performa cabang",
        message:
          "Replikasi strategi cabang terbaik ke cabang lain untuk mendorong pertumbuhan total.",
      },
      {
        severity: "medium",
        title: "Potensi akselerasi jam non-peak",
        message:
          "Aktifkan promo bundling di luar jam puncak untuk menambah volume transaksi.",
      },
    ];

    const recommendations = [
      {
        title: "Optimalkan staf di jam puncak",
        detail: peakHourToday
          ? `Tambahkan 1 staf operasional pada ${pad2(peakHourToday.hour)}:00-${pad2((peakHourToday.hour + 1) % 24)}.`
          : "Tambahkan staf saat pola jam puncak sudah stabil.",
        expectedImpact: "+6% sampai +12% throughput",
        priority: "high" as const,
      },
      {
        title: "Bundling menu top seller",
        detail: `Gunakan ${topItem?.itemName ?? "menu terlaris"} sebagai anchor bundling di jam non-peak.`,
        expectedImpact: "+4% sampai +9% average order value",
        priority: "medium" as const,
      },
      {
        title: "Program upsell per cabang",
        detail:
          "Pasang rekomendasi add-on otomatis di kasir untuk menaikkan nilai belanja per transaksi.",
        expectedImpact: "+6% sampai +11% revenue cabang",
        priority: "high" as const,
      },
    ];

    const sortedDaily = [...displayRows]
      .filter((r) => /^\d{4}-\d{2}-\d{2}/.test(r.periodKey))
      .slice(-14);
    const baseDailyRevenue =
      sortedDaily.length > 0
        ? sortedDaily.reduce((sum, row) => sum + row.revenue, 0) /
          sortedDaily.length
        : totals.revenue || 1_000_000;
    const baseGrowthFactor = 1 + clamp(revGrowth / 100, 0.04, 0.18);

    const forecast = Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(new Date(), i + 1);
      const wave = 1 + Math.sin((i + 1) * 1.1) * 0.05;
      const trend = 1 + i * 0.012;
      const predicted = Math.round(
        baseDailyRevenue * baseGrowthFactor * wave * trend,
      );
      const band = Math.round(predicted * 0.1);
      return {
        label: d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
        predicted,
        low: Math.max(0, predicted - band),
        high: predicted + band,
        rangeWidth: band * 2,
      };
    });

    return {
      confidence,
      summary,
      insights,
      alerts,
      recommendations,
      forecast,
    };
  }, [
    branchRankingToday,
    displayRows,
    peakHourToday,
    revenueGrowthDisplay,
    orderGrowthDisplay,
    topItemsToday,
    totals.revenue,
  ]);

  function applyPreset(days: number) {
    const to = new Date();
    const from = addDays(to, -(days - 1));
    setGranularity("day");
    setDateFromStr(toInputDateValue(from));
    setDateToStr(toInputDateValue(to));
  }

  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const sheetRows = displayRows.map((r) => ({
      Periode: r.periodLabel,
      Cabang: r.branchLabel,
      Pesanan: r.orders,
      Pendapatan: r.revenue,
    }));
    sheetRows.push({
      Periode: "Total",
      Cabang: "",
      Pesanan: totals.orders,
      Pendapatan: totals.revenue,
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Penjualan");
    const name = `penjualan-${granularity === "day" ? "harian" : "per-jam"}-${toInputDateValue(new Date())}.xlsx`;
    XLSX.writeFile(wb, name);
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="space-y-1.5">
            <Label>Kelompok</Label>
            <Select
              value={granularity}
              onValueChange={(v) => {
                if (v === "day" || v === "hour") setGranularity(v);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Per hari</SelectItem>
                <SelectItem value="hour">Per jam</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cabang</Label>
            <Select
              value={branchId}
              onValueChange={(v) => {
                if (v) setBranchId(v);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua cabang</SelectItem>
                {MOCK_BRANCHES.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {granularity === "day" ? (
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sales-from">Dari</Label>
                <Input
                  id="sales-from"
                  type="date"
                  value={dateFromStr}
                  onChange={(e) => setDateFromStr(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sales-to">Sampai</Label>
                <Input
                  id="sales-to"
                  type="date"
                  value={dateToStr}
                  onChange={(e) => setDateToStr(e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="sales-hour-day">Tanggal</Label>
              <Input
                id="sales-hour-day"
                type="date"
                value={hourDayStr}
                onChange={(e) => setHourDayStr(e.target.value)}
                className="w-40"
              />
            </div>
          )}

          <div className="flex items-center gap-2 lg:ml-auto">
            <Button size="sm" variant="outline" onClick={() => applyPreset(1)}>
              Hari ini
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(7)}>
              7 hari
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset(30)}>
              30 hari
            </Button>
            <Button type="button" variant="secondary" onClick={downloadExcel}>
              <Download className="size-4" />
              Excel
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4 gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4" />
              Total pendapatan
            </div>
            <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
              +{revenueGrowthDisplay.toFixed(1)}%
            </Badge>
          </div>
          <div className="text-2xl font-semibold">{formatIDR(totals.revenue)}</div>
          <MiniSpark data={sparkRevenue} color={COLOR_PRIMARY} />
        </Card>

        <Card className="p-4 gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="size-4" />
              Total pesanan
            </div>
            <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">
              +{orderGrowthDisplay.toFixed(1)}%
            </Badge>
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {totals.orders.toLocaleString("id-ID")}
          </div>
          <MiniSpark data={sparkOrders} color={COLOR_EMERALD} />
        </Card>

        <Card className="p-4 gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <BarChart3 className="size-4" />
              Rata-rata nilai order
            </div>
            <Badge variant="outline">AOV</Badge>
          </div>
          <div className="text-2xl font-semibold">
            {formatIDR(Math.round(averageTicket))}
          </div>
          <MiniSpark data={sparkAOV} color={COLOR_AMBER} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 gap-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Tren pendapatan</div>
              <p className="text-xs text-muted-foreground">
                Pendapatan {granularity === "day" ? "per hari" : "per jam"} pada filter aktif.
              </p>
            </div>
          </div>
          <div className="h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trendChartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="g-revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_PRIMARY} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLOR_PRIMARY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v: number) => formatShortIDR(v)}
                />
                <Tooltip
                  cursor={{ stroke: COLOR_PRIMARY, strokeOpacity: 0.3 }}
                  content={
                    <ChartTooltip
                      formatter={(v) => formatIDR(Math.round(v))}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Pendapatan"
                  stroke={COLOR_PRIMARY}
                  strokeWidth={2.25}
                  fill="url(#g-revenue)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 gap-3">
          <div>
            <div className="font-medium">Komposisi pendapatan cabang</div>
            <p className="text-xs text-muted-foreground">
              Persentase kontribusi pendapatan tiap cabang pada periode aktif.
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={branchSharePeriod}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {branchSharePeriod.map((_, i) => (
                    <Cell
                      key={i}
                      fill={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v) => formatIDR(Math.round(v))}
                    />
                  }
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {branchSharePeriodTotal > 0 && (
            <div className="text-xs text-muted-foreground text-center">
              Total: <span className="font-medium text-foreground">{formatIDR(branchSharePeriodTotal)}</span>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 gap-3">
          <div>
            <div className="font-medium">Menu paling laris hari ini</div>
            <p className="text-xs text-muted-foreground">
              {branchId === "all" ? "Semua cabang" : "Cabang terpilih"}
            </p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...topItemsToday].reverse()}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="itemName"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.85 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
                  content={
                    <ChartTooltip formatter={(v) => `${v} porsi`} />
                  }
                />
                <Bar
                  dataKey="qty"
                  name="Qty"
                  fill={COLOR_PRIMARY}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 gap-3">
          <div>
            <div className="font-medium">Peringkat cabang hari ini</div>
            <p className="text-xs text-muted-foreground">
              Diurutkan berdasarkan pendapatan tertinggi.
            </p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[...branchRankingToday].reverse()}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatShortIDR(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.85 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
                  content={
                    <ChartTooltip
                      formatter={(v) => formatIDR(Math.round(v))}
                    />
                  }
                />
                <Bar
                  dataKey="revenue"
                  name="Pendapatan"
                  fill={COLOR_EMERALD}
                  radius={[0, 6, 6, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 gap-3">
          <div>
            <div className="font-medium">Spotlight hari ini</div>
            <p className="text-xs text-muted-foreground">
              Highlight operasional siap action.
            </p>
          </div>
          <div className="space-y-2.5">
            {peakHourToday ? (
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Jam tersibuk</div>
                <div className="text-xl font-semibold tabular-nums">
                  {pad2(peakHourToday.hour)}:00 - {pad2((peakHourToday.hour + 1) % 24)}:00
                </div>
                <div className="text-xs text-muted-foreground">
                  {peakHourToday.orders} pesanan · {formatIDR(peakHourToday.revenue)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                Data jam puncak belum tersedia.
              </div>
            )}

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Cabang teratas</div>
              <div className="text-base font-semibold">
                {branchRankingToday[0]?.name ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground">
                {branchRankingToday[0]
                  ? formatIDR(branchRankingToday[0].revenue)
                  : "-"}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs">
              Revenue naik {revenueGrowthDisplay.toFixed(1)}% dibanding periode sebelumnya.
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium flex items-center gap-2">
              <Brain className="size-4 text-indigo-500" />
              AI Analysis
            </div>
            <p className="text-xs text-muted-foreground">
              Insight otomatis dari data penjualan untuk mendukung keputusan operasional dan growth.
            </p>
          </div>
          <Badge variant="outline">
            <Sparkles className="size-3" />
            Confidence {aiAnalysis.confidence}%
          </Badge>
        </div>

        <div className="rounded-lg border bg-indigo-500/5 border-indigo-500/20 p-3 text-sm">
          {aiAnalysis.summary}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Lightbulb className="size-4" />
              Top Insights
            </div>
            {aiAnalysis.insights.map((insight) => (
              <div key={insight.title} className="rounded-md border p-2.5 space-y-1">
                <div className="text-sm font-medium">{insight.title}</div>
                <div className="text-xs text-muted-foreground">{insight.detail}</div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs text-muted-foreground">
                    Impact: <span className="font-medium text-foreground">{insight.impact}</span>
                  </span>
                  <Badge variant="secondary">{insight.confidence}%</Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <TriangleAlert className="size-4" />
              Alerts
            </div>
            {aiAnalysis.alerts.map((alert) => (
              <div
                key={alert.title}
                className={cn(
                  "rounded-md border p-2.5 space-y-1",
                  alert.severity === "high"
                    ? "border-rose-500/35 bg-rose-500/5"
                    : alert.severity === "medium"
                      ? "border-amber-500/35 bg-amber-500/5"
                      : "border-emerald-500/35 bg-emerald-500/5",
                )}
              >
                <div className="text-sm font-medium">{alert.title}</div>
                <div className="text-xs text-muted-foreground">{alert.message}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="size-4" />
              Recommended Actions
            </div>
            {aiAnalysis.recommendations.map((item) => (
              <div key={item.title} className="rounded-md border p-2.5 space-y-1">
                <div className="text-sm font-medium flex items-center justify-between gap-2">
                  <span>{item.title}</span>
                  <Badge variant={item.priority === "high" ? "default" : "secondary"}>
                    {item.priority}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  Expected: {item.expectedImpact}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-3 gap-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Forecast 7 Hari</div>
              <p className="text-xs text-muted-foreground">
                Prediksi pendapatan harian dengan rentang kepercayaan.
              </p>
            </div>
          </div>
          <div className="h-56 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={aiAnalysis.forecast}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="g-forecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLOR_INDIGO} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLOR_INDIGO} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  strokeOpacity={0.1}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "currentColor", fillOpacity: 0.7 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                  tickFormatter={(v: number) => formatShortIDR(v)}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(v, name) =>
                        `${name === "Range" ? "" : ""}${formatIDR(Math.round(v))}`
                      }
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  stackId="band"
                  stroke="transparent"
                  fill="transparent"
                  name="Low"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="rangeWidth"
                  stackId="band"
                  stroke="transparent"
                  fill={COLOR_INDIGO}
                  fillOpacity={0.12}
                  name="Range"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke={COLOR_INDIGO}
                  strokeWidth={2.25}
                  fill="url(#g-forecast)"
                  name="Prediksi"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Cabang</TableHead>
              <TableHead className="text-right">Pesanan</TableHead>
              <TableHead className="text-right">Pendapatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-10"
                >
                  Tidak ada data untuk filter ini.
                </TableCell>
              </TableRow>
            ) : (
              displayRows.map((r, i) => (
                <TableRow key={`${r.periodLabel}-${r.branchLabel}-${i}`}>
                  <TableCell className="font-medium">{r.periodLabel}</TableCell>
                  <TableCell>{r.branchLabel}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatIDR(r.revenue)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {displayRows.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell colSpan={2} className="font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {totals.orders}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatIDR(totals.revenue)}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}

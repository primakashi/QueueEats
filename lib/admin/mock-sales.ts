export const MOCK_BRANCHES = [
  { id: "b1", name: "Cabang Pusat" },
  { id: "b2", name: "Cabang Selatan" },
  { id: "b3", name: "Cabang Timur" },
] as const;

export type MockSalesHourlyRow = {
  bucketStart: string;
  branchId: string;
  branchName: string;
  orders: number;
  revenue: number;
};

export type MockTopItemRow = {
  itemId: string;
  itemName: string;
  qty: number;
  revenue: number;
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/** Hourly mock points for every branch in [rangeStart, rangeEnd]. */
export function buildMockHourlySales(
  rangeStart: Date,
  rangeEnd: Date,
): MockSalesHourlyRow[] {
  const start = new Date(rangeStart);
  start.setMinutes(0, 0, 0);
  start.setSeconds(0, 0);
  const end = new Date(rangeEnd);
  end.setMinutes(59, 59, 999);

  const rows: MockSalesHourlyRow[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 3600000) {
    for (const b of MOCK_BRANCHES) {
      const key = `${t}-${b.id}`;
      const h = hashSeed(key);
      const orders = 2 + (h % 18);
      const revenue = orders * (15000 + (h % 50) * 1000);
      rows.push({
        bucketStart: new Date(t).toISOString(),
        branchId: b.id,
        branchName: b.name,
        orders,
        revenue,
      });
    }
  }
  return rows;
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const MOCK_MENU_ITEMS = [
  { id: "m1", name: "Nasi Goreng Special", basePrice: 32000 },
  { id: "m2", name: "Mie Ayam Bakso", basePrice: 26000 },
  { id: "m3", name: "Ayam Geprek", basePrice: 28000 },
  { id: "m4", name: "Sate Ayam", basePrice: 35000 },
  { id: "m5", name: "Es Teh Manis", basePrice: 9000 },
  { id: "m6", name: "Jus Alpukat", basePrice: 18000 },
  { id: "m7", name: "Nasi Campur", basePrice: 30000 },
  { id: "m8", name: "Sop Buntut", basePrice: 49000 },
] as const;

/**
 * Deterministic mock for "most ordered menu today".
 * Uses date+branch hash so numbers stay stable across reloads.
 */
export function buildMockTopItemsForDay(
  day: Date,
  branchId: string,
  limit = 5,
): MockTopItemRow[] {
  const yyyy = day.getFullYear();
  const mm = String(day.getMonth() + 1).padStart(2, "0");
  const dd = String(day.getDate()).padStart(2, "0");
  const dayKey = `${yyyy}-${mm}-${dd}`;

  const rows = MOCK_MENU_ITEMS.map((item) => {
    const seed = `${dayKey}-${branchId}-${item.id}`;
    const h = hashSeed(seed);
    const qty = 8 + (h % 65);
    const price = item.basePrice + (h % 7) * 1000;
    return {
      itemId: item.id,
      itemName: item.name,
      qty,
      revenue: qty * price,
    };
  });

  return rows.sort((a, b) => b.qty - a.qty).slice(0, limit);
}

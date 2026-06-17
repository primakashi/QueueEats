import { PageHeader } from "@/components/page-header";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

type AuditLog = {
  id: string;
  table_name: string;
  record_id: string;
  entity_name: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string;
  created_at: string;
};

const TABLE_LABEL: Record<string, string> = {
  menu_items: "Menu",
  menu_categories: "Kategori Menu",
  outlets: "Outlet",
  profiles: "Staf",
  order_channels: "Saluran Pesanan",
  payment_methods: "Metode Pembayaran",
  payment_providers: "Provider Pembayaran",
  restaurants: "Restoran",
  discounts: "Diskon",
};

const ACTION_LABEL: Record<string, string> = {
  create: "Dibuat",
  update: "Diubah",
  delete: "Dihapus",
};

const FIELD_LABEL: Record<string, string> = {
  price: "Harga",
  name: "Nama",
  tax_rate: "Pajak",
  service_charge_rate: "Biaya Layanan",
  service_charge_channels: "Saluran Service Charge",
  round_total: "Pembulatan",
  role: "Peran",
  is_active: "Status aktif",
  kind: "Tipe",
  description: "Deskripsi",
  default_daily_quota: "Kuota harian default",
  value: "Nilai",
  value_type: "Tipe nilai",
  scope: "Cakupan",
};

function formatValue(field: string | null, value: string | null): string {
  if (value === null) return "—";
  if (field === "price" || field === "value") {
    const n = Number(value);
    return Number.isFinite(n)
      ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n)
      : value;
  }
  if (field === "tax_rate" || field === "service_charge_rate") {
    const n = Number(value);
    return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : value;
  }
  if (field === "is_active" || field === "round_total") {
    if (value === "true" || value === "t") return "Aktif";
    if (value === "false" || value === "f") return "Nonaktif";
    return value;
  }
  if (field === "service_charge_channels") {
    // jsonb / text[] arrives as JSON-stringified; render compactly.
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return "Semua saluran";
        return parsed.join(", ");
      }
    } catch {
      // fall through
    }
    return value;
  }
  return value;
}

function actionVariant(action: string): "default" | "secondary" | "destructive" {
  if (action === "create") return "default";
  if (action === "delete") return "destructive";
  return "secondary";
}

export default async function ChangelogPage() {
  const profile = await requireRole(["owner", "admin"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  // Scope logs to users who belong to this restaurant
  let logsQuery = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
  if (rid) {
    const { data: staffIds } = await supabase.from("profiles").select("id").eq("restaurant_id", rid);
    const ids = (staffIds ?? []).map((p) => p.id as string);
    if (ids.length) logsQuery = logsQuery.in("changed_by_id", ids);
    else logsQuery = logsQuery.eq("changed_by_id", "00000000-0000-0000-0000-000000000000");
  }
  const { data: logs } = await logsQuery;

  const rows = (logs ?? []) as AuditLog[];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Log Perubahan"
        description="Riwayat perubahan harga, pajak, dan data sensitif lainnya."
      />

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground text-center">
          Belum ada perubahan yang tercatat.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">Waktu</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Oleh</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tabel</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entitas</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksi</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Field</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nilai Lama</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nilai Baru</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => {
                const isPriceDecrease =
                  row.field_name === "price" &&
                  row.old_value !== null &&
                  row.new_value !== null &&
                  Number(row.new_value) < Number(row.old_value);
                return (
                  <tr key={row.id} className={isPriceDecrease ? "bg-red-50 dark:bg-red-950/20" : undefined}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{row.changed_by_name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {TABLE_LABEL[row.table_name] ?? row.table_name}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" title={row.entity_name ?? undefined}>
                      {row.entity_name ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={actionVariant(row.action)} className="text-xs">
                        {ACTION_LABEL[row.action] ?? row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.field_name ? (FIELD_LABEL[row.field_name] ?? row.field_name) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatValue(row.field_name, row.old_value)}
                    </td>
                    <td className={`px-4 py-3 font-medium whitespace-nowrap ${isPriceDecrease ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatValue(row.field_name, row.new_value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

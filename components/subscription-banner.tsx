import { AlertTriangle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  endDate: string | null;
};

/**
 * Whole-day difference between today (local) and endDate (YYYY-MM-DD).
 * Positive = days remaining, 0 = expires today, negative = already past.
 * Uses date-only math so the value is stable regardless of the time of day.
 */
function daysUntil(endDate: string): number {
  const [y, m, d] = endDate.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const end = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((end - today) / (1000 * 60 * 60 * 24));
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("id-ID", { dateStyle: "long" });
  } catch {
    return d;
  }
}

/**
 * Shows a banner when the restaurant subscription is within 30 days of expiry
 * or already expired. Visible to all logged-in users as an early warning.
 */
export function SubscriptionBanner({ endDate }: Props) {
  if (!endDate) return null;

  const days = daysUntil(endDate);
  if (days > 30) return null;

  const expired = days < 0;
  const urgent = expired || days <= 3;

  const message = expired
    ? `Langganan telah berakhir ${Math.abs(days)} hari lalu (${formatDate(endDate)}). Hubungi tim Solusi Saji untuk perpanjangan.`
    : days === 0
      ? `Langganan berakhir hari ini (${formatDate(endDate)}). Segera lakukan perpanjangan.`
      : `Langganan akan berakhir dalam ${days} hari (${formatDate(endDate)}).`;

  return (
    <div
      data-print-hide
      role="status"
      className={cn(
        "border-b px-4 py-2 text-sm flex items-center gap-3",
        urgent
          ? "bg-destructive/10 border-destructive/30 text-destructive"
          : "bg-amber-50 border-amber-200 text-amber-900",
      )}
    >
      {urgent ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : (
        <Calendar className="h-4 w-4 shrink-0" />
      )}
      <span className="flex-1">{message}</span>
    </div>
  );
}

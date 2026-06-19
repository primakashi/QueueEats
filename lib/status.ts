import type { OrderStatus, PaymentStatus, QueueEntryStatus } from "@/lib/types";

export function statusColor(s: OrderStatus): string {
  switch (s) {
    case "pending":
      return "bg-slate-200 text-slate-900 hover:bg-slate-200";
    case "accepted":
      return "bg-blue-500 text-white hover:bg-blue-500";
    case "preparing":
      return "bg-amber-500 text-white hover:bg-amber-500";
    case "ready":
      return "bg-emerald-500 text-white hover:bg-emerald-500";
    case "completed":
      return "bg-sky-600 text-white hover:bg-sky-600";
    case "cancelled":
      return "bg-red-600 text-white hover:bg-red-600";
  }
}

export function paymentColor(s: PaymentStatus): string {
  switch (s) {
    case "unpaid":
      return "bg-muted text-foreground hover:bg-muted";
    case "pending":
      return "bg-amber-100 text-amber-900 hover:bg-amber-100";
    case "paid":
      return "bg-emerald-100 text-emerald-900 hover:bg-emerald-100";
    case "failed":
    case "expired":
      return "bg-red-100 text-red-900 hover:bg-red-100";
  }
}

export function queueStatusColor(s: QueueEntryStatus): string {
  switch (s) {
    case "waiting":
      return "bg-slate-200 text-slate-900 hover:bg-slate-200";
    case "called":
      return "bg-amber-500 text-white hover:bg-amber-500";
    case "seated":
      return "bg-emerald-500 text-white hover:bg-emerald-500";
    case "completed":
      return "bg-sky-600 text-white hover:bg-sky-600";
    case "no_show":
      return "bg-red-600 text-white hover:bg-red-600";
    case "cancelled":
      return "bg-zinc-400 text-white hover:bg-zinc-400";
  }
}

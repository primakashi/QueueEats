import type { QueueEntryStatus } from "@/lib/types";

const AVG_TABLE_TURNOVER_MINUTES = 15;

export function estimateWaitMinutes(
  status: QueueEntryStatus,
  position: number,
): number {
  if (status !== "waiting") return 0;
  const safePosition = Math.max(1, position);
  return safePosition * AVG_TABLE_TURNOVER_MINUTES;
}

export function estimateWaitLabel(
  status: QueueEntryStatus,
  position: number,
): string {
  if (status === "called") return "Meja siap sekarang";
  if (status !== "waiting") return "Tidak perlu menunggu";
  return `Perkiraan tunggu ~${estimateWaitMinutes(status, position)} menit`;
}

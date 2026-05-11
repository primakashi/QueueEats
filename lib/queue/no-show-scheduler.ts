import { autoExpireCalledEntries } from "@/lib/queue/service";

declare global {
  var __queueNoShowSchedulerStarted: boolean | undefined;
}

export function startQueueNoShowScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (globalThis.__queueNoShowSchedulerStarted) return;
  globalThis.__queueNoShowSchedulerStarted = true;

  setInterval(async () => {
    const result = await autoExpireCalledEntries();
    if (!result.ok) {
      console.error("[QUEUE CRON] failed:", result.error);
      return;
    }
    if (result.updated > 0) {
      console.log(`[QUEUE CRON] auto no-show updated: ${result.updated}`);
    }
  }, 60_000);
}

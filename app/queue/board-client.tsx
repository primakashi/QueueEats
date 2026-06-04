"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { queueStatusColor } from "@/lib/status";
import { QUEUE_STATUS_LABEL_ID, type QueueEntryStatus } from "@/lib/types";
import { estimateWaitLabel } from "@/lib/queue/eta";

type QueueBoardEntry = {
  id: string;
  name: string;
  party_size: number;
  status: QueueEntryStatus;
  queue_number: number;
  position: number;
  waiting_in_store: boolean;
};

type QueueBoardResponse = {
  restaurant_name: string;
  entries: QueueBoardEntry[];
};

function firstName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Tamu";
  return trimmed.split(/\s+/)[0] ?? "Tamu";
}

export function QueueBoardClient({
  initialData,
}: {
  initialData: QueueBoardResponse;
}) {
  const [data, setData] = useState<QueueBoardResponse | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/queue/list", { cache: "no-store" });
      const json = (await res.json()) as QueueBoardResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat antrian");
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Gagal memuat antrian");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => void load(), 10_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight">
            Papan antrian — {data?.restaurant_name ?? "Al Jazeerah Express"}
          </h1>
          {/* <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Auto-refresh every 10 seconds
          </p> */}
          {refreshing && (
            <p className="text-xs text-muted-foreground mt-1">Memperbarui...</p>
          )}
        </header>

        {error ? (
          <Card className="p-6 text-center text-sm">{error}</Card>
        ) : (
          <div className="grid gap-3">
            {(data?.entries ?? []).map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.status === "called"
                    ? "rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-4 sm:px-6"
                    : "rounded-xl border bg-card px-4 py-4 sm:px-6"
                }
              >
                <div className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-3 sm:gap-6">
                  <div className="text-2xl sm:text-4xl font-semibold tabular-nums">
                    #{entry.queue_number}
                  </div>
                  <div className="text-xl sm:text-3xl font-medium">
                    {firstName(entry.name)}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-base sm:text-2xl text-muted-foreground">
                      {entry.party_size} orang
                    </div>
                    {entry.waiting_in_store && (
                      <div className="text-xs sm:text-sm font-medium text-emerald-700">
                        Sudah di lokasi
                      </div>
                    )}
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {estimateWaitLabel(entry.status, entry.position)}
                    </div>
                  </div>
                  <Badge className={`text-sm sm:text-lg h-7 sm:h-9 ${queueStatusColor(entry.status)}`}>
                    {QUEUE_STATUS_LABEL_ID[entry.status]}
                  </Badge>
                </div>
              </div>
            ))}
            {data && data.entries.length === 0 && (
              <Card className="p-10 text-center text-lg text-muted-foreground">
                Tidak ada antrian aktif.
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

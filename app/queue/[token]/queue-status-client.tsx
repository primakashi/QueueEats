"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queueStatusColor } from "@/lib/status";
import { QUEUE_STATUS_LABEL_ID, type QueueEntryStatus } from "@/lib/types";
import { estimateWaitLabel } from "@/lib/queue/eta";

type QueueState = {
  token: string;
  name: string;
  party_size: number;
  status: QueueEntryStatus;
  queue_number: number;
  position: number;
};

const STATUS_COPY: Record<QueueEntryStatus, (position: number) => string> = {
  waiting: (position) => `Anda saat ini urutan #${position} dalam antrean`,
  called: () => "Meja Anda siap. Silakan datang dalam 10 menit",
  seated: () => "Anda sudah duduk — selamat menikmati",
  no_show: () => "Anda ditandai tidak hadir. Silakan daftar antrean lagi jika masih di dekat sini",
  cancelled: () => "Antrean dibatalkan",
};

export function QueueStatusClient({
  token,
  initialData,
  initialError,
}: {
  token: string;
  initialData: QueueState | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState<QueueState | null>(initialData);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/queue/${token}`, { cache: "no-store" });
      const json = (await res.json()) as QueueState & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Entri antrean tidak ditemukan.");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Tidak dapat memuat data antrean.");
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    const id = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const waitingOnly = data?.status === "waiting";
  const statusMessage = useMemo(() => {
    if (!data) return "";
    return STATUS_COPY[data.status](data.position);
  }, [data]);

  async function cancelQueue() {
    if (!waitingOnly || !data) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/queue/${token}/cancel`, { method: "POST" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Tidak dapat membatalkan antrean.");
        return;
      }
      await load();
    } finally {
      setCancelling(false);
    }
  }

  if (error || !data) {
    return (
      <Card className="p-6 text-center">
        <p className="font-medium">{error ?? "Entri antrean tidak ditemukan."}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">Nomor antrean</div>
        <div className="text-3xl font-semibold tabular-nums">
          {data.queue_number > 0 ? data.queue_number : "-"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Nama" value={data.name} />
        <Field label="Jumlah orang" value={`${data.party_size} orang`} />
        <Field
          label="Posisi saat ini"
          value={data.position > 0 ? `#${data.position}` : "-"}
        />
        <div className="space-y-1">
          <div className="text-muted-foreground">Status</div>
          <Badge className={queueStatusColor(data.status)}>
            {QUEUE_STATUS_LABEL_ID[data.status]}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{statusMessage}</div>
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {estimateWaitLabel(data.status, data.position)}
      </div>
      {refreshing && (
        <p className="text-xs text-muted-foreground">Memperbarui status...</p>
      )}

      <Button
        variant="outline"
        className="w-full"
        disabled={!waitingOnly || cancelling}
        onClick={cancelQueue}
      >
        {cancelling ? "Membatalkan..." : "Saya tidak jadi datang"}
      </Button>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

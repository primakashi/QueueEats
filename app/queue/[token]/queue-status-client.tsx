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
  waiting_in_store: boolean;
  party_has_infant: boolean;
  party_has_elderly: boolean;
  party_has_child: boolean;
};

const STATUS_COPY: Record<QueueEntryStatus, (position: number) => string> = {
  waiting: (position) => `Anda saat ini urutan #${position} dalam antrian`,
  called: () => "Meja Anda siap. Silakan datang dalam 10 menit",
  seated: () => "Anda sudah duduk — selamat menikmati",
  completed: () => "Terima kasih sudah berkunjung",
  no_show: () =>
    "Anda ditandai tidak hadir. Silakan daftar antrian lagi jika masih di dekat sini",
  cancelled: () => "Antrian dibatalkan",
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
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/queue/${token}`, { cache: "no-store" });
      const json = (await res.json()) as QueueState & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Entri antrian tidak ditemukan.");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Tidak dapat memuat data antrian.");
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
  const canSetPresence =
    data && (data.status === "waiting" || data.status === "called");

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
        setError(json.error ?? "Tidak dapat membatalkan antrian.");
        return;
      }
      await load();
    } finally {
      setCancelling(false);
    }
  }

  async function setPresence(waitingInStore: boolean) {
    if (!canSetPresence) return;
    setPresenceBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/queue/${token}/waiting-in-store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waiting_in_store: waitingInStore }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Tidak dapat memperbarui status kehadiran.");
        return;
      }
      await load();
    } finally {
      setPresenceBusy(false);
    }
  }

  if (error || !data) {
    return (
      <Card className="p-6 text-center">
        <p className="font-medium">{error ?? "Entri antrian tidak ditemukan."}</p>
      </Card>
    );
  }

  const partyTags: { key: string; label: string }[] = [];
  if (data.party_has_infant) partyTags.push({ key: "infant", label: "Bayi / balita" });
  if (data.party_has_elderly) partyTags.push({ key: "elderly", label: "Lansia" });
  if (data.party_has_child) partyTags.push({ key: "child", label: "Anak-anak" });

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">Nomor antrian</div>
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

      {canSetPresence && (
        <div className="rounded-lg border px-3 py-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Status terbaru
          </div>
          <div className="text-sm font-bold">
            {data.waiting_in_store ? "Di lokasi" : "Belum di lokasi"}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.waiting_in_store
              ? "Anda sudah mengonfirmasi sedang menunggu di lokasi."
              : "Konfirmasi bila sudah menunggu di lokasi."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {!data.waiting_in_store ? (
              <Button
                className="flex-1"
                variant="outline"
                disabled={presenceBusy}
                onClick={() => void setPresence(true)}
              >
                {presenceBusy ? "Menyimpan..." : "Saya sudah di restoran"}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1"
                disabled={presenceBusy}
                onClick={() => void setPresence(false)}
              >
                {presenceBusy ? "Menyimpan..." : "Belum di lokasi / dalam perjalanan"}
              </Button>
            )}
          </div>
        </div>
      )}

      {partyTags.length > 0 && (
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Komposisi rombongan</div>
          <div className="flex flex-wrap gap-1.5">
            {partyTags.map((t) => (
              <Badge key={t.key} variant="secondary">
                {t.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{statusMessage}</div>
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {estimateWaitLabel(data.status, data.position)}
      </div>
      {refreshing && (
        <p className="text-xs text-muted-foreground">Memperbarui status...</p>
      )}

      <Button
        variant="outline"
        className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
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

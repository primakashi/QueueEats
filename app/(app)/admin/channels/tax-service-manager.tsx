"use client";

import { useMemo, useState, useTransition } from "react";
import { FileText, Users, CircleDot, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderChannelConfig, Restaurant } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { updateTaxService } from "./actions";
import { Toggle } from "./toggle";

const SAMPLE_SUBTOTAL = 100_000;

/**
 * Render a rate like 0.10 as "10" (not "10.00", not "0.10" * 100 = "10.000000000000002").
 * Returns `fallback` when the stored value is 0 / null so the input has a starting suggestion.
 */
function percentInput(stored: number | null | undefined, fallback: string): string {
  const n = (stored ?? 0) * 100;
  if (n <= 0) return fallback;
  return Number(n.toFixed(4)).toString();
}

export function TaxServiceManager({
  restaurant,
  channels,
}: {
  restaurant: Restaurant | null;
  channels: OrderChannelConfig[];
}) {
  const [pending, start] = useTransition();
  const [taxEnabled, setTaxEnabled] = useState((restaurant?.tax_rate ?? 0) > 0);
  const [taxPercent, setTaxPercent] = useState<string>(
    percentInput(restaurant?.tax_rate, "10"),
  );
  const [taxEditing, setTaxEditing] = useState(false);

  const [serviceEnabled, setServiceEnabled] = useState((restaurant?.service_charge_rate ?? 0) > 0);
  const [servicePercent, setServicePercent] = useState<string>(
    percentInput(restaurant?.service_charge_rate, "5"),
  );
  const [serviceChannels, setServiceChannels] = useState<Set<string>>(
    new Set(restaurant?.service_charge_channels ?? []),
  );
  const [serviceEditing, setServiceEditing] = useState(false);

  const [round, setRound] = useState(restaurant?.round_total ?? false);

  const directChannels = useMemo(
    () => channels.filter((c) => c.kind === "direct" || c.kind === null),
    [channels],
  );

  const tax = taxEnabled ? Math.round((Number(taxPercent) / 100) * SAMPLE_SUBTOTAL) : 0;
  const service = serviceEnabled ? Math.round((Number(servicePercent) / 100) * SAMPLE_SUBTOTAL) : 0;
  const rawTotal = SAMPLE_SUBTOTAL + tax + service;
  const totalPreview = round ? Math.round(rawTotal / 1000) * 1000 : rawTotal;

  function persist(overrides?: {
    nextTaxEnabled?: boolean;
    nextServiceEnabled?: boolean;
    nextRound?: boolean;
    nextChannels?: Set<string>;
  }) {
    const fd = new FormData();
    const finalTaxEnabled = overrides?.nextTaxEnabled ?? taxEnabled;
    const finalServiceEnabled = overrides?.nextServiceEnabled ?? serviceEnabled;
    const finalRound = overrides?.nextRound ?? round;
    const finalChannels = overrides?.nextChannels ?? serviceChannels;

    if (finalTaxEnabled) fd.set("tax_enabled", "on");
    if (finalServiceEnabled) fd.set("service_enabled", "on");
    if (finalRound) fd.set("round_total", "on");
    fd.set("tax_rate", taxPercent || "0");
    fd.set("service_charge_rate", servicePercent || "0");
    for (const id of finalChannels) fd.append("service_charge_channels", id);

    start(async () => {
      const res = await updateTaxService(fd);
      if (!res.ok) toast.error(res.error);
      else toast.success("Pengaturan disimpan");
    });
  }

  function toggleTax() {
    const next = !taxEnabled;
    setTaxEnabled(next);
    persist({ nextTaxEnabled: next });
  }
  function toggleService() {
    const next = !serviceEnabled;
    setServiceEnabled(next);
    persist({ nextServiceEnabled: next });
  }
  function toggleRound() {
    const next = !round;
    setRound(next);
    persist({ nextRound: next });
  }
  function toggleServiceChannel(id: string) {
    const next = new Set(serviceChannels);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setServiceChannels(next);
    persist({ nextChannels: next });
  }

  function commitTax() {
    setTaxEditing(false);
    persist();
  }
  function commitService() {
    setServiceEditing(false);
    persist();
  }

  if (!restaurant) {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Pengaturan pajak hanya tersedia untuk akun yang terhubung ke restoran.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* PPN */}
      <SettingCard
        icon={<FileText className="size-5" />}
        iconBg="bg-sky-500"
        title="PPN"
        accent={taxEnabled ? `${taxPercent}%` : null}
        accentBadge={taxEnabled ? "Semua transaksi" : null}
        description="Persentase pajak pertambahan nilai yang dikenakan pada setiap transaksi."
        enabled={taxEnabled}
        onToggle={toggleTax}
        pending={pending}
        editing={taxEditing}
        onEdit={() => setTaxEditing(true)}
        editForm={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitTax();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="tax-percent" className="text-xs">Persentase PPN (%)</Label>
              <Input
                id="tax-percent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" size="icon" aria-label="Simpan">
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Batal"
              onClick={() => {
                setTaxEditing(false);
                setTaxPercent(percentInput(restaurant.tax_rate, "10"));
              }}
            >
              <X className="size-4" />
            </Button>
          </form>
        }
      />

      {/* Service Charge */}
      <SettingCard
        icon={<Users className="size-5" />}
        iconBg="bg-violet-500"
        title="Service Charge"
        accent={serviceEnabled ? `${servicePercent}%` : null}
        accentBadge={
          serviceEnabled
            ? serviceChannels.size === 0
              ? "Semua saluran"
              : [...serviceChannels]
                  .map((id) => channels.find((c) => c.id === id)?.name)
                  .filter(Boolean)
                  .join(", ")
            : null
        }
        description="Biaya layanan tambahan yang dikenakan atas pelayanan restoran."
        enabled={serviceEnabled}
        onToggle={toggleService}
        pending={pending}
        editing={serviceEditing}
        onEdit={() => setServiceEditing(true)}
        editForm={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitService();
            }}
            className="space-y-3"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="svc-percent" className="text-xs">Persentase (%)</Label>
                <Input
                  id="svc-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={servicePercent}
                  onChange={(e) => setServicePercent(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" size="icon" aria-label="Simpan">
                <Check className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Batal"
                onClick={() => {
                  setServiceEditing(false);
                  setServicePercent(percentInput(restaurant.service_charge_rate, "5"));
                }}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Berlaku untuk saluran (kosongkan = semua)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {directChannels.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Belum ada saluran direct. Tambahkan dari tab Saluran Pesanan.
                </span>
              )}
              {directChannels.map((c) => {
                const on = serviceChannels.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleServiceChannel(c.id)}
                    className={`text-xs rounded-full border px-3 py-1 transition-colors ${
                      on
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background hover:bg-muted border-border"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </form>
        }
      />

      {/* Round total */}
      <SettingCard
        icon={<CircleDot className="size-5" />}
        iconBg="bg-orange-500"
        title="Pembulatan Total"
        accent={null}
        accentBadge={null}
        description="Bulatkan total akhir transaksi untuk kemudahan kasir."
        enabled={round}
        onToggle={toggleRound}
        pending={pending}
        editing={false}
        onEdit={() => {}}
        showEdit={false}
        editForm={null}
      />

      {/* Preview */}
      <Card className="bg-muted/50 p-5 gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pratinjau perhitungan
        </div>
        <div className="space-y-2 text-sm">
          <Row label="Subtotal contoh" value={formatIDR(SAMPLE_SUBTOTAL)} />
          {serviceEnabled && (
            <Row label={`Service Charge (${servicePercent}%)`} value={`+ ${formatIDR(service)}`} accent />
          )}
          {taxEnabled && (
            <Row label={`PPN (${taxPercent}%)`} value={`+ ${formatIDR(tax)}`} accent />
          )}
          {round && rawTotal !== totalPreview && (
            <Row
              label="Pembulatan"
              value={`${totalPreview > rawTotal ? "+" : ""} ${formatIDR(totalPreview - rawTotal)}`}
              accent
            />
          )}
          <div className="pt-2 border-t flex justify-between items-baseline">
            <span className="font-semibold">Total</span>
            <span className="font-bold tabular-nums">{formatIDR(totalPreview)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${accent ? "text-violet-600" : ""}`}>{value}</span>
    </div>
  );
}

function SettingCard({
  icon,
  iconBg,
  title,
  accent,
  accentBadge,
  description,
  enabled,
  onToggle,
  pending,
  editing,
  onEdit,
  editForm,
  showEdit = true,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  accent: string | null;
  accentBadge: string | null;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  pending: boolean;
  editing: boolean;
  onEdit: () => void;
  editForm: React.ReactNode;
  showEdit?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 px-4 py-4">
        <div className={`h-10 w-10 rounded-lg ${iconBg} text-white grid place-items-center shrink-0`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{title}</span>
            {accent && (
              <span className="text-base font-bold tabular-nums">{accent}</span>
            )}
            {accentBadge && (
              <span className="text-[10px] font-medium uppercase tracking-wide rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5">
                {accentBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showEdit && (
            <Button size="sm" variant="outline" onClick={onEdit} disabled={!enabled} className="h-8">
              <Pencil className="size-3.5 mr-1" /> Ubah
            </Button>
          )}
          <Toggle
            checked={enabled}
            onChange={onToggle}
            disabled={pending}
            ariaLabel={enabled ? "Nonaktifkan" : "Aktifkan"}
          />
        </div>
      </div>
      {editing && enabled && (
        <div className="border-t bg-muted/30 px-4 py-3">{editForm}</div>
      )}
    </div>
  );
}

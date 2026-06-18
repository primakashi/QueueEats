"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Usb, Bluetooth } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Status = "checking" | "ok" | "warn" | "error";

type Check = {
  label: string;
  status: Status;
  detail: string;
};

type UsbDevice = {
  vendorId: number;
  productId: number;
  name: string;
};

function StatusIcon({ status }: { status: Status }) {
  if (status === "checking")
    return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "warn") return <AlertCircle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function statusBadge(status: Status) {
  if (status === "checking") return <Badge variant="secondary">Mengecek…</Badge>;
  if (status === "ok") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OK</Badge>;
  if (status === "warn") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Perhatian</Badge>;
  return <Badge variant="destructive">Tidak tersedia</Badge>;
}

export function DeviceStatus() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [usbDevices, setUsbDevices] = useState<UsbDevice[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const results: Check[] = [];

    // 1. Platform check
    const ua = navigator.userAgent;
    const isAndroid = /android/i.test(ua);
    const isChrome = /chrome/i.test(ua) && !/edg/i.test(ua);
    const isChromeAndroid = isAndroid && isChrome;
    results.push({
      label: "Browser & platform",
      status: isChromeAndroid ? "ok" : isChrome ? "warn" : "warn",
      detail: isChromeAndroid
        ? "Android Chrome — siap untuk RawBT dan WebUSB"
        : isChrome
          ? "Chrome desktop — dialog cetak hanya ke PDF. Gunakan tablet Android untuk tes ke printer asli."
          : "Bukan Chrome — WebUSB dan RawBT tidak didukung. Gunakan Chrome atau Edge.",
    });

    // 2. WebUSB
    const hasUsb = "usb" in navigator;
    results.push({
      label: "WebUSB",
      status: hasUsb ? "ok" : "warn",
      detail: hasUsb
        ? "Tersedia — bisa scan printer USB yang terhubung via OTG"
        : "Tidak tersedia di browser ini — USB-OTG tetap bisa via RawBT, tapi tidak bisa di-scan dari halaman ini",
    });

    // 3. Web Bluetooth
    const hasBt = "bluetooth" in navigator;
    results.push({
      label: "Web Bluetooth",
      status: hasBt ? "ok" : "warn",
      detail: hasBt
        ? "Tersedia — catatan: hanya mendeteksi perangkat BLE, bukan Bluetooth Classic. Printer thermal umumnya Bluetooth Classic, jadi pair via Android Settings + RawBT."
        : "Tidak tersedia — tidak masalah, pair printer Bluetooth lewat Android Settings + RawBT seperti biasa.",
    });

    // Defer to avoid calling setState synchronously in effect body
    Promise.resolve().then(() => setChecks(results));

    // 4. Enumerate previously WebUSB-authorized devices
    if (hasUsb) {
      type RawUSBDevice = { vendorId: number; productId: number; manufacturerName?: string; productName?: string };
      (navigator as unknown as { usb: { getDevices(): Promise<RawUSBDevice[]> } }).usb
        .getDevices()
        .then((devices) => {
          setUsbDevices(
            devices.map((d) => ({
              vendorId: d.vendorId,
              productId: d.productId,
              name:
                [d.manufacturerName, d.productName].filter(Boolean).join(" ") ||
                `USB Device (${hex(d.vendorId)}:${hex(d.productId)})`,
            })),
          );
        })
        .catch(() => {/* permission denied or unavailable */});
    }
  }, []);

  const scanUsb = async () => {
    if (!("usb" in navigator)) return;
    setScanning(true);
    try {
      type RawUSBDevice = { vendorId: number; productId: number; manufacturerName?: string; productName?: string };
      // Shows the browser USB device picker. If the printer appears here, USB-OTG is working.
      const device = await (
        navigator as unknown as {
          usb: { requestDevice(o: object): Promise<RawUSBDevice> };
        }
      ).usb.requestDevice({ filters: [] });
      const name =
        [device.manufacturerName, device.productName].filter(Boolean).join(" ") ||
        `USB Device (${hex(device.vendorId)}:${hex(device.productId)})`;
      setUsbDevices((prev) =>
        prev.some((d) => d.vendorId === device.vendorId && d.productId === device.productId)
          ? prev
          : [...prev, { vendorId: device.vendorId, productId: device.productId, name }],
      );
    } catch {
      // User cancelled picker or no device found — not an error
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">Status Perangkat</h2>
        <span className="text-xs text-muted-foreground">Otomatis terdeteksi dari browser</span>
      </div>

      <div className="space-y-2">
        {checks.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Mendeteksi…
          </div>
        ) : (
          checks.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-lg border p-3">
              <StatusIcon status={c.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.label}</span>
                  {statusBadge(c.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {c.detail}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* USB device list — only rendered client-side so navigator is defined */}
      {typeof navigator !== "undefined" && "usb" in navigator && (
        <div className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Usb className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Perangkat USB Terdeteksi</span>
              {usbDevices.length > 0 && (
                <Badge variant="secondary">{usbDevices.length}</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={scanUsb}
              disabled={scanning}
            >
              {scanning ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Usb className="h-3 w-3" />
              )}
              Scan USB
            </Button>
          </div>

          {usbDevices.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Belum ada perangkat USB yang diizinkan. Tekan <strong>Scan USB</strong> lalu pilih
              printer dari daftar — jika printer muncul di picker, artinya kabel OTG berfungsi.
            </p>
          ) : (
            <ul className="space-y-1">
              {usbDevices.map((d) => (
                <li
                  key={`${d.vendorId}-${d.productId}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground">
                    ({hex(d.vendorId)}:{hex(d.productId)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Bluetooth note */}
      <div className="rounded-lg border p-3 flex items-start gap-3">
        <Bluetooth className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Printer Bluetooth</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Browser tidak dapat mendeteksi printer Bluetooth Classic (jenis yang digunakan
            printer thermal umumnya). Untuk memverifikasi koneksi Bluetooth: pastikan printer
            sudah ter-pair di <strong>Android Settings → Bluetooth</strong>, lalu buka{" "}
            <strong>RawBT → Test Print</strong>. Jika berhasil dari RawBT, aplikasi ini juga
            akan berhasil.
          </p>
        </div>
      </div>
    </div>
  );
}

function hex(n: number) {
  return `0x${n.toString(16).padStart(4, "0").toUpperCase()}`;
}

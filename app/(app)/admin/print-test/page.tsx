import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PrintTestActions } from "./print-test-actions";
import { DeviceStatus } from "./device-status";

export default async function PrintTestPage() {
  await requireRole(["admin", "owner", "branch_manager", "super_admin"]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-4">
      <PageHeader
        title="Tes Printer"
        description="Cetak struk dan tiket dapur menggunakan data sampel untuk memverifikasi konfigurasi printer di outlet — tanpa membuat pesanan asli."
      />

      <Card className="p-5 gap-0">
        <DeviceStatus />
      </Card>

      <Card className="p-5 gap-4">
        <div>
          <h2 className="font-semibold text-sm">Bagaimana cara pakai</h2>
          <ol className="mt-2 list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li>Pastikan printer thermal sudah terhubung ke tablet (USB-OTG / Bluetooth).</li>
            <li>
              Pastikan RawBT sudah ter-set sebagai printer default di Android (Settings →
              Connected devices → Printing → RawBT → ON).
            </li>
            <li>
              Tekan salah satu tombol di bawah — jendela cetak akan muncul dengan data sampel.
              Verifikasi hasil cetak rapi, lebar 58mm, dan tidak terpotong.
            </li>
            <li>
              Jika dialog tidak muncul dalam 8 detik, tombol <em>Cetak Sekarang</em> akan
              muncul — artinya konfigurasi printer perlu dicek.
            </li>
          </ol>
        </div>

        <Separator />

        <PrintTestActions />

        <p className="text-xs text-muted-foreground">
          Data yang dicetak adalah pesanan fiktif (No. <code>TES-001</code>). Tidak ada data
          tersimpan di database dan tidak memengaruhi laporan penjualan.
        </p>
      </Card>
    </div>
  );
}

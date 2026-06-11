import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

type ChangeKind = "new" | "fix" | "improvement";

type ChangeEntry = {
  version: string;
  date: string;
  changes: { kind: ChangeKind; text: string }[];
};

const KIND_LABEL: Record<ChangeKind, string> = {
  new: "Baru",
  fix: "Perbaikan",
  improvement: "Peningkatan",
};

const KIND_VARIANT: Record<ChangeKind, "default" | "secondary" | "outline"> = {
  new: "default",
  fix: "secondary",
  improvement: "outline",
};

const CHANGELOG: ChangeEntry[] = [
  {
    version: "v1.9",
    date: "11 Jun 2025",
    changes: [
      { kind: "new", text: "Halaman changelog untuk owner" },
    ],
  },
  {
    version: "v1.8",
    date: "6 Jun 2025",
    changes: [
      { kind: "improvement", text: "Label peran navigasi diperbarui agar lebih deskriptif" },
      { kind: "improvement", text: "Kasir: tampilan ulang panel pembayaran dengan ringkasan yang lebih jelas" },
      { kind: "fix", text: "Struk: nominal pajak dan biaya layanan kini dapat diedit sebelum cetak" },
    ],
  },
  {
    version: "v1.7",
    date: "2 Jun 2025",
    changes: [
      { kind: "new", text: "Metode pembayaran EDC ditambahkan ke kasir" },
      { kind: "new", text: "Papan waiter: filter status dan tampilan lebih ringkas" },
      { kind: "improvement", text: "Peran Owner sekarang bisa mengakses halaman Outlet, Penjualan, dan Rekonsiliasi" },
    ],
  },
  {
    version: "v1.6",
    date: "26 Mei 2025",
    changes: [
      { kind: "new", text: "Pajak dan biaya layanan per outlet (dapat dikonfigurasi)" },
      { kind: "improvement", text: "Rekonsiliasi: filter per sumber pembayaran dan ringkasan total" },
      { kind: "fix", text: "Nominal pesanan tidak terhitung pajak pada beberapa outlet" },
    ],
  },
  {
    version: "v1.5",
    date: "19 Mei 2025",
    changes: [
      { kind: "new", text: "Manajemen saluran pesanan (GrabFood, GoFood, ShopeeFood, dll.)" },
      { kind: "improvement", text: "Sidebar dapat diciutkan di layar besar" },
      { kind: "fix", text: "Notifikasi antrean WhatsApp tidak terkirim pada kondisi tertentu" },
    ],
  },
  {
    version: "v1.4",
    date: "12 Mei 2025",
    changes: [
      { kind: "new", text: "Rekonsiliasi harian per outlet" },
      { kind: "new", text: "Dashboard penjualan dengan filter tanggal dan outlet" },
      { kind: "improvement", text: "Halaman outlet kini menampilkan status aktif/arsip" },
    ],
  },
  {
    version: "v1.3",
    date: "5 Mei 2025",
    changes: [
      { kind: "new", text: "Antrian tamu dengan notifikasi WhatsApp" },
      { kind: "new", text: "Papan antrean publik untuk layar tampilan" },
      { kind: "improvement", text: "Dapur: kartu pesanan dapat diklik untuk melihat detail item" },
    ],
  },
  {
    version: "v1.2",
    date: "28 Apr 2025",
    changes: [
      { kind: "new", text: "Manajemen multi-outlet" },
      { kind: "improvement", text: "Pesanan dapat dipindah antar meja oleh waiter" },
      { kind: "fix", text: "Status dapur tidak sinkron saat ada beberapa tab terbuka" },
    ],
  },
  {
    version: "v1.1",
    date: "21 Apr 2025",
    changes: [
      { kind: "new", text: "Cetak struk otomatis setelah pembayaran lunas" },
      { kind: "new", text: "Pembayaran QRIS via Xendit" },
      { kind: "improvement", text: "Tampilan menu publik untuk pelanggan" },
    ],
  },
  {
    version: "v1.0",
    date: "14 Apr 2025",
    changes: [
      { kind: "new", text: "Rilis perdana — POS dasar dengan waiter, dapur, dan kasir" },
      { kind: "new", text: "Manajemen menu dan kategori" },
      { kind: "new", text: "Manajemen staf dengan peran (waiter, dapur, kasir, admin)" },
    ],
  },
];

export default async function ChangelogPage() {
  await requireRole(["owner", "admin"]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Changelog"
        description="Riwayat pembaruan dan perbaikan sistem."
      />
      <div className="mt-6 space-y-8">
        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="flex gap-6">
            <div className="w-24 shrink-0 text-right">
              <div className="text-sm font-semibold">{entry.version}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{entry.date}</div>
            </div>
            <div className="flex-1 border-l pl-6 pb-2">
              <ul className="space-y-2">
                {entry.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Badge
                      variant={KIND_VARIANT[c.kind]}
                      className="mt-px shrink-0 text-xs"
                    >
                      {KIND_LABEL[c.kind]}
                    </Badge>
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

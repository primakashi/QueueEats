import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex-1 grid place-items-center p-8">
      <div className="max-w-sm text-center space-y-4">
        <h1 className="text-2xl font-semibold">Akses ditolak</h1>
        <p className="text-muted-foreground">
          Akun Anda tidak memiliki izin untuk membuka halaman tersebut.
        </p>
        <Button render={<Link href="/" />}>Kembali ke beranda</Button>
      </div>
    </main>
  );
}

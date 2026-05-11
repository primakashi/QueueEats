import { getQueueEntryByToken } from "@/lib/queue/service";
import { QueueStatusClient } from "./queue-status-client";

type Props = { params: Promise<{ token: string }> };
export const dynamic = "force-dynamic";

export default async function QueueTokenPage({ params }: Props) {
  const { token } = await params;
  const initialData = await getQueueEntryByToken(token);

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <div className="max-w-md mx-auto space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Status antrean Anda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Halaman ini memperbarui otomatis setiap 10 detik.
          </p>
        </div>
        <QueueStatusClient
          token={token}
          initialData={
            initialData
              ? {
                  token: initialData.token,
                  name: initialData.name,
                  party_size: initialData.party_size,
                  status: initialData.status,
                  queue_number: initialData.queue_number,
                  position: initialData.position,
                }
              : null
          }
          initialError={initialData ? null : "Entri antrean tidak ditemukan."}
        />
      </div>
    </main>
  );
}

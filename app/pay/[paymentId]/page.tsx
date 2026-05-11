import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PayPanel, type MockPaymentSummary } from "./pay-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ayam Seruni — Konfirmasi pembayaran" };

export default async function PayPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mock_payment", {
    pid: paymentId,
  });

  if (error || !data) {
    notFound();
  }

  const summary = data as MockPaymentSummary;

  return (
    <main className="min-h-dvh bg-muted/40 flex flex-col">
      <header className="border-b bg-background">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-semibold">
            Q
          </div>
          <div>
            <div className="font-semibold leading-tight">Ayam Seruni</div>
            <div className="text-xs text-muted-foreground">
              Pesanan {summary.order_number}
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 flex items-start justify-center">
        <PayPanel summary={summary} />
      </div>
    </main>
  );
}

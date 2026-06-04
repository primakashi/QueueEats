import { Users } from "lucide-react";
import { getOrCreateRestaurant } from "@/lib/queue/service";
import { QueueJoinForm } from "./queue-join-form";

export const metadata = {
  title: "Gabung antrian · Al Jazeerah Express",
};
export const dynamic = "force-dynamic";

export default async function QueueJoinPage() {
  const restaurant = await getOrCreateRestaurant();

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:py-12">
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-primary text-primary-foreground items-center justify-center mb-3">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Antre di {restaurant.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Daftar sekarang; kami akan WhatsApp saat giliran Anda hampir tiba.
          </p>
        </div>
        <QueueJoinForm />
      </div>
    </main>
  );
}

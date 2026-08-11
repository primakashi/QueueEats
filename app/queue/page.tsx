import { listQueueEntries } from "@/lib/queue/service";
import { getVerifiedProfile } from "@/lib/auth";
import { QueueBoardClient } from "./board-client";

export const metadata = {
  title: "Papan antrian · Al Jazeerah Express",
};
export const dynamic = "force-dynamic";

export default async function QueueBoardPage() {
  const profile = await getVerifiedProfile();
  const initialData = await listQueueEntries(profile?.restaurant_id);
  return <QueueBoardClient initialData={initialData} />;
}

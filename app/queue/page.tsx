import { listQueueEntries } from "@/lib/queue/service";
import { QueueBoardClient } from "./board-client";

export const metadata = {
  title: "Papan antrian · Al Jazeerah Express",
};
export const dynamic = "force-dynamic";

export default async function QueueBoardPage() {
  const initialData = await listQueueEntries();
  return <QueueBoardClient initialData={initialData} />;
}

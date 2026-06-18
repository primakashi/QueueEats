import { requireRole } from "@/lib/auth";
import { AutoPrint } from "@/components/auto-print";
import { KitchenTicketDocument } from "@/components/kitchen-ticket-document";
import { SAMPLE_ITEMS, SAMPLE_ORDER } from "../sample-data";

export default async function SampleKitchenTicketPage() {
  await requireRole(["admin", "owner", "branch_manager", "super_admin"]);

  return (
    <>
      <AutoPrint />
      <KitchenTicketDocument order={SAMPLE_ORDER} items={SAMPLE_ITEMS} />
    </>
  );
}

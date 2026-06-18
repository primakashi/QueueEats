import { requireRole } from "@/lib/auth";
import { AutoPrint } from "@/components/auto-print";
import { ReceiptDocument } from "@/components/receipt-document";
import {
  SAMPLE_DISCOUNTS,
  SAMPLE_ITEMS,
  SAMPLE_ORDER,
} from "../sample-data";

export default async function SampleReceiptPage() {
  await requireRole(["admin", "owner", "branch_manager", "super_admin"]);

  return (
    <>
      <AutoPrint />
      <ReceiptDocument
        order={SAMPLE_ORDER}
        items={SAMPLE_ITEMS}
        appliedDiscounts={SAMPLE_DISCOUNTS}
      />
    </>
  );
}

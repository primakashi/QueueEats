import type { Order, OrderItem } from "@/lib/types";
import type { ReceiptAppliedDiscount } from "@/components/receipt-document";

/*
 * Hardcoded sample order used only by the /admin/print-test routes so an
 * owner can dry-run printing at the venue without creating a real order.
 *
 * `created_at` is computed at module load to avoid SSR/CSR drift inside
 * formatDateTime — the value is rendered immediately to the print window so
 * the small staleness (page lifetime) is irrelevant.
 */
const now = new Date().toISOString();

export const SAMPLE_ORDER: Order = {
  id: "00000000-0000-0000-0000-000000000000",
  order_number: "TES-001",
  restaurant_id: null,
  service_type: "dine_in",
  table_number: "5",
  customer_name: "Tamu Tes",
  status: "completed",
  payment_status: "paid",
  payment_method: "cash",
  subtotal: 75000,
  total: 82500,
  notes: "Cetak ini untuk uji coba printer",
  created_by: null,
  outlet_id: null,
  order_channel: null,
  payment_destination: "Tunai",
  tax_amount: 7500,
  service_charge_amount: 0,
  discount_amount: 0,
  cancelled_by: null,
  cancelled_at: null,
  created_at: now,
  updated_at: now,
};

export const SAMPLE_ITEMS: OrderItem[] = [
  {
    id: "sample-item-1",
    order_id: SAMPLE_ORDER.id,
    menu_item_id: null,
    name_snapshot: "Nasi Mandhi Kambing",
    price_snapshot: 45000,
    quantity: 1,
    notes: "Tanpa cabai",
    created_at: now,
  },
  {
    id: "sample-item-2",
    order_id: SAMPLE_ORDER.id,
    menu_item_id: null,
    name_snapshot: "Es Teh Manis",
    price_snapshot: 8000,
    quantity: 2,
    notes: null,
    created_at: now,
  },
  {
    id: "sample-item-3",
    order_id: SAMPLE_ORDER.id,
    menu_item_id: null,
    name_snapshot: "Kebab Ayam",
    price_snapshot: 14000,
    quantity: 1,
    notes: null,
    created_at: now,
  },
];

export const SAMPLE_DISCOUNTS: ReceiptAppliedDiscount[] = [];

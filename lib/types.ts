export type UserRole = "waiter" | "kitchen" | "cashier" | "admin" | "owner" | "branch_manager" | "finance" | "super_admin";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "expired";
export type PaymentMethod = "qris" | "cash" | "edc";
export type OrderServiceType = "dine_in" | "takeaway";
export type OrderChannel = string;

export type OrderChannelConfig = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};
export type QueueEntryStatus =
  | "waiting"
  | "called"
  | "seated"
  | "completed"
  | "no_show"
  | "cancelled";
export type QueueNotificationState =
  | "none"
  | "joined"
  | "almost"
  | "called"
  | "no_show";

export type Restaurant = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  outlet_id: string | null;
  restaurant_id: string | null;
  created_at: string;
};

export type MenuCategory = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type Outlet = {
  id: string;
  name: string;
  location: string | null;
  is_temporary: boolean;
  active_from: string | null;
  active_until: string | null;
  is_archived: boolean;
  created_at: string;
  tax_rate: number;
  service_charge_rate: number;
};

export type Order = {
  id: string;
  order_number: string;
  restaurant_id: string | null;
  service_type?: OrderServiceType;
  table_number: string | null;
  customer_name: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  total: number;
  notes: string | null;
  created_by: string | null;
  outlet_id: string | null;
  order_channel: OrderChannel | null;
  payment_destination: string | null;
  tax_amount: number;
  service_charge_amount: number;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  name_snapshot: string;
  price_snapshot: number;
  quantity: number;
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  order_id: string;
  provider: string;
  xendit_qr_id: string | null;
  qr_string: string | null;
  amount: number;
  status: PaymentStatus;
  paid_at: string | null;
  raw_payload: unknown;
  created_at: string;
  updated_at: string;
};

export type OrderWithItems = Order & {
  order_items: OrderItem[];
};

export type QueueEntry = {
  id: string;
  restaurant_id: string;
  name: string;
  party_size: number;
  phone: string | null;
  token: string;
  status: QueueEntryStatus;
  notification_state: QueueNotificationState;
  assigned_table: string | null;
  pending_wa_url: string | null;
  waiting_in_store: boolean;
  party_has_infant: boolean;
  party_has_elderly: boolean;
  party_has_child: boolean;
  created_at: string;
  called_at: string | null;
  seated_at: string | null;
};

export type CashierSessionStatus = "open" | "closed";
export type CashMovementType = "cash_in" | "cash_out";
export type CashMovementCategory =
  | "starting_cash"
  | "owner_top_up"
  | "petty_cash_purchase"
  | "supplier_payment"
  | "correction"
  | "other";

export type CashierSession = {
  id: string;
  outlet_id: string | null;
  opened_by: string | null;
  closed_by: string | null;
  session_date: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  actual_closing_cash: number | null;
  notes: string | null;
  status: CashierSessionStatus;
};

export type CashMovement = {
  id: string;
  session_id: string;
  outlet_id: string | null;
  type: CashMovementType;
  category: CashMovementCategory;
  amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export const CASH_MOVEMENT_CATEGORY_LABEL: Record<CashMovementCategory, string> = {
  starting_cash: "Modal awal",
  owner_top_up: "Top-up pemilik",
  petty_cash_purchase: "Pembelian kas kecil",
  supplier_payment: "Pembayaran supplier",
  correction: "Koreksi",
  other: "Lainnya",
};

export const CASH_IN_CATEGORIES: CashMovementCategory[] = [
  "owner_top_up",
  "correction",
  "other",
];

export const CASH_OUT_CATEGORIES: CashMovementCategory[] = [
  "petty_cash_purchase",
  "supplier_payment",
  "correction",
  "other",
];

export const ROLE_LABEL: Record<UserRole, string> = {
  waiter: "Layanan",
  kitchen: "Dapur",
  cashier: "Kasir",
  admin: "Admin",
  owner: "Owner",
  branch_manager: "Manajer Cabang",
  finance: "Keuangan",
  super_admin: "Super Admin",
};

/** Roles that have HQ-level access (all outlets, null outlet_id). */
export const HQ_ROLES: UserRole[] = ["admin", "owner", "finance"];

/** Roles that must be scoped to a single outlet. */
export const BRANCH_ROLES: UserRole[] = ["branch_manager", "cashier", "waiter", "kitchen"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Menunggu",
  preparing: "Dimasak",
  ready: "Siap",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Belum dibayar",
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export const QUEUE_STATUS_LABEL_ID: Record<QueueEntryStatus, string> = {
  waiting: "Menunggu",
  called: "Dipanggil",
  seated: "Sudah duduk",
  completed: "Selesai",
  no_show: "Tidak hadir",
  cancelled: "Dibatalkan",
};

/** Fallback labels for orders that predate the order_channels table. */
export const ORDER_CHANNEL_LABEL: Record<string, string> = {
  direct: "Langsung",
  shopeefood: "ShopeeFood",
  grabfood: "GrabFood",
  gofood: "GoFood",
  other: "Lainnya",
};

export const PAYMENT_DESTINATIONS = [
  "QRIS BCA",
  "QRIS BRI",
  "QRIS BNI",
  "QRIS Mandiri",
  "QRIS ShopeePay",
  "QRIS GoPay",
  "Transfer BCA",
  "Transfer BRI",
  "Transfer Mandiri",
  "Tunai",
  "Lainnya",
] as const;

export type PaymentDestination = typeof PAYMENT_DESTINATIONS[number];

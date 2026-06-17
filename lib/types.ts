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

export type OrderChannelKind = "direct" | "online";

export type OrderChannelConfig = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  kind: OrderChannelKind | null;
  commission_rate: number;
};

export const CHANNEL_PRESETS: Record<OrderChannelKind, string[]> = {
  direct: ["Dine-in", "Takeaway"],
  online: [
    "GoFood",
    "GrabFood",
    "ShopeeFood",
    "WhatsApp",
    "Tokopedia",
    "Shopee",
    "Blibli",
    "TikTokShop",
    "Facebook",
    "Festival",
  ],
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
  subscription_end_date: string | null;
  subscription_notes: string | null;
  tax_rate: number;
  service_charge_rate: number;
  service_charge_channels: string[];
  round_total: boolean;
  created_at: string;
};

export type PaymentMethodKind = "simple" | "provider";

export type PaymentMethodConfig = {
  id: string;
  restaurant_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  kind: PaymentMethodKind;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentProviderConfig = {
  id: string;
  payment_method_id: string;
  restaurant_id: string | null;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentMethodWithProviders = PaymentMethodConfig & {
  providers: PaymentProviderConfig[];
};

/** Default payment-method seed used when onboarding a new restaurant. */
export const DEFAULT_PAYMENT_METHOD_SEED: ReadonlyArray<{
  slug: string;
  name: string;
  description: string;
  kind: PaymentMethodKind;
  color: string;
  providers?: ReadonlyArray<{ slug: string; name: string; description: string | null; color: string }>;
}> = [
  { slug: "cash", name: "Cash", description: "Pembayaran tunai langsung", kind: "simple", color: "#16a34a" },
  {
    slug: "qris",
    name: "QRIS",
    description: "Scan QR untuk pembayaran digital",
    kind: "provider",
    color: "#6366f1",
    providers: [
      { slug: "gopay", name: "GoPay", description: "Gojek", color: "#16a34a" },
      { slug: "ovo", name: "OVO", description: "Grab / Tokopedia", color: "#7c3aed" },
      { slug: "shopeepay", name: "ShopeePay", description: "Shopee", color: "#f97316" },
      { slug: "dana", name: "DANA", description: null, color: "#2563eb" },
    ],
  },
  {
    slug: "transfer",
    name: "Transfer Bank",
    description: "Transfer via rekening bank",
    kind: "provider",
    color: "#0ea5e9",
    providers: [
      { slug: "bca", name: "BCA", description: null, color: "#1e3a8a" },
      { slug: "mandiri", name: "Mandiri", description: null, color: "#1d4ed8" },
      { slug: "bri", name: "BRI", description: null, color: "#0369a1" },
      { slug: "bni", name: "BNI", description: null, color: "#ea580c" },
    ],
  },
  { slug: "kartu", name: "Kartu", description: "Debit dan kredit via EDC", kind: "simple", color: "#475569" },
  {
    slug: "online_delivery",
    name: "Online Delivery",
    description: "Pembayaran via platform delivery",
    kind: "provider",
    color: "#f97316",
    providers: [
      { slug: "gofood", name: "GoFood", description: "Gojek delivery", color: "#16a34a" },
      { slug: "grabfood", name: "GrabFood", description: "Grab delivery", color: "#16a34a" },
      { slug: "shopeefood", name: "ShopeeFood", description: "Shopee delivery", color: "#f97316" },
    ],
  },
];

export type DiscountScope = "menu_item" | "transaction" | "daily";
export type DiscountValueType = "amount" | "percent";

export type Discount = {
  id: string;
  restaurant_id: string | null;
  name: string;
  scope: DiscountScope;
  value_type: DiscountValueType;
  value: number;
  active_from: string | null;
  active_until: string | null;
  menu_item_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderDiscount = {
  id: string;
  order_id: string;
  discount_id: string | null;
  scope: DiscountScope;
  name_snapshot: string;
  value_type: DiscountValueType;
  value_snapshot: number;
  amount: number;
  order_item_id: string | null;
  reason: string | null;
  applied_by: string | null;
  created_at: string;
};

export const DISCOUNT_SCOPE_LABEL: Record<DiscountScope, string> = {
  menu_item: "Per item",
  transaction: "Per transaksi",
  daily: "Promo harian",
};

export const DISCOUNT_VALUE_TYPE_LABEL: Record<DiscountValueType, string> = {
  amount: "Nominal (Rp)",
  percent: "Persen (%)",
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
  cost_price: number | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  default_daily_quota: number | null;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
};

export type StockMovementReason =
  | "opening"
  | "add"
  | "remove"
  | "sale"
  | "cancel_restore"
  | "adjust"
  | "disable"
  | "enable"
  | "confirm";

export type DailyStock = {
  id: string;
  outlet_id: string;
  menu_item_id: string;
  restaurant_id: string | null;
  stock_date: string;
  daily_quota: number | null;
  opening_stock: number;
  current_stock: number;
  is_active: boolean;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  daily_stock_id: string;
  outlet_id: string | null;
  restaurant_id: string | null;
  menu_item_id: string | null;
  change: number;
  resulting_stock: number;
  reason: StockMovementReason;
  order_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type MenuStockOverride = {
  id: string;
  menu_item_id: string;
  outlet_id: string;
  daily_quota: number | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
};

export const STOCK_REASON_LABEL: Record<StockMovementReason, string> = {
  opening: "Stok awal",
  add: "Tambah",
  remove: "Kurangi",
  sale: "Penjualan",
  cancel_restore: "Pembatalan",
  adjust: "Koreksi",
  disable: "Nonaktifkan",
  enable: "Aktifkan",
  confirm: "Konfirmasi",
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
  discount_amount: number;
  cancelled_by: string | null;
  cancelled_at: string | null;
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

export const PAYMENT_DESTINATION_GROUPS: ReadonlyArray<{
  label: string;
  options: ReadonlyArray<string>;
}> = [
  { label: "Tunai", options: ["Tunai"] },
  { label: "Aplikasi", options: ["GoFood", "GrabFood", "ShopeeFood"] },
  { label: "Kartu", options: ["Kartu EDC"] },
  {
    label: "Transfer Bank",
    options: ["Transfer BCA", "Transfer BRI", "Transfer BNI", "Transfer Mandiri"],
  },
  {
    label: "QRIS",
    options: [
      "QRIS BCA",
      "QRIS BRI",
      "QRIS BNI",
      "QRIS Mandiri",
      "QRIS ShopeePay",
      "QRIS GoPay",
    ],
  },
  { label: "Lainnya", options: ["Lainnya"] },
];

export const PAYMENT_DESTINATIONS: ReadonlyArray<string> =
  PAYMENT_DESTINATION_GROUPS.flatMap((g) => g.options);

export type PaymentDestination = string;

export type UserRole = "waiter" | "kitchen" | "cashier" | "admin";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "expired";
export type PaymentMethod = "qris" | "cash";
export type QueueEntryStatus =
  | "waiting"
  | "called"
  | "seated"
  | "no_show"
  | "cancelled";
export type QueueNotificationState =
  | "none"
  | "joined"
  | "almost"
  | "called"
  | "no_show";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
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

export type Order = {
  id: string;
  order_number: string;
  table_number: string | null;
  customer_name: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  subtotal: number;
  total: number;
  notes: string | null;
  created_by: string | null;
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

export const ROLE_LABEL: Record<UserRole, string> = {
  waiter: "Waiters/Host",
  kitchen: "Dapur",
  cashier: "Kasir",
  admin: "Admin",
};

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
  no_show: "Tidak hadir",
  cancelled: "Dibatalkan",
};

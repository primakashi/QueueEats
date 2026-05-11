import { createAdminClient } from "@/lib/supabase/admin";
import type { QueueEntryStatus, QueueNotificationState } from "@/lib/types";
import { generateQueueToken } from "./token";
import { generateWhatsAppUrl, logWhatsAppMock } from "./whatsapp";

export type QueueListItem = {
  id: string;
  token: string;
  name: string;
  party_size: number;
  phone: string | null;
  status: QueueEntryStatus;
  notification_state: QueueNotificationState;
  pending_wa_url: string | null;
  assigned_table: string | null;
  waiting_in_store: boolean;
  party_has_infant: boolean;
  party_has_elderly: boolean;
  party_has_child: boolean;
  created_at: string;
  called_at: string | null;
  seated_at: string | null;
  queue_number: number;
  position: number;
};

type QueueEntryRow = Omit<QueueListItem, "queue_number" | "position"> & {
  restaurant_id: string;
};

type TransitionResult =
  | { ok: true; entry: QueueEntryRow }
  | { ok: false; code: 404 | 400 | 409; error: string };

export type QueueCreateInput = {
  name: string;
  party_size: number;
  phone?: string | null;
  waiting_in_store?: boolean;
  party_has_infant?: boolean;
  party_has_elderly?: boolean;
  party_has_child?: boolean;
};

const STATUS_ACTIVE: QueueEntryStatus[] = ["waiting", "called"];
const STATUS_ON_FLOOR: QueueEntryStatus[] = ["waiting", "called", "seated"];
const INDONESIA_PHONE_RE = /^(62|0)\d+$/;

function rowDefaults(row: QueueEntryRow): QueueEntryRow {
  return {
    ...row,
    waiting_in_store: row.waiting_in_store ?? false,
    party_has_infant: row.party_has_infant ?? false,
    party_has_elderly: row.party_has_elderly ?? false,
    party_has_child: row.party_has_child ?? false,
  };
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function getRestaurantFallbackName(): string {
  return process.env.NEXT_PUBLIC_RESTAURANT_NAME ?? "Ayam Seruni";
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Kesalahan server tak terduga";
}

export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const stripped = input.replace(/\s+/g, "");
  if (stripped.length === 0) return null;
  if (!/^\d+$/.test(stripped)) {
    throw new Error("Nomor WhatsApp hanya boleh berisi angka");
  }
  if (!INDONESIA_PHONE_RE.test(stripped)) {
    throw new Error("Nomor WhatsApp harus diawali 62 atau 0");
  }
  return stripped;
}

export async function getOrCreateRestaurant(): Promise<{
  id: string;
  name: string;
}> {
  const admin = createAdminClient();
  const { data: existing, error: readErr } = await admin
    .from("restaurants")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing) return existing;

  const { data: inserted, error: insertErr } = await admin
    .from("restaurants")
    .insert({ name: getRestaurantFallbackName() })
    .select("id,name")
    .single();
  if (insertErr) throw new Error(insertErr.message);
  return inserted;
}

export async function computeWaitingPosition(
  restaurantId: string,
  createdAt: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .eq("status", "waiting")
    .lt("created_at", createdAt);
  if (error) throw new Error(error.message);
  return (count ?? 0) + 1;
}

async function computeActiveQueueNumber(
  restaurantId: string,
  createdAt: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("queue_entries")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .in("status", STATUS_ACTIVE)
    .lt("created_at", createdAt);
  if (error) throw new Error(error.message);
  return (count ?? 0) + 1;
}

function buildJoinMessage(
  entry: Pick<QueueEntryRow, "name" | "token">,
  position: number,
  restaurantName: string,
): string {
  return `Hai ${entry.name}, Anda saat ini urutan #${position} di antrian ${restaurantName}. Cek status di: ${getBaseUrl()}/queue/${entry.token}. Kami akan kirim WhatsApp lagi saat giliran Anda hampir tiba.`;
}

function buildCalledMessage(entry: Pick<QueueEntryRow, "name">, restaurantName: string): string {
  return `Hai ${entry.name}, meja Anda siap di ${restaurantName}. Silakan datang dalam 10 menit. Setelah itu nomor antrian Anda akan kedaluwarsa otomatis.`;
}

function buildNoShowMessage(entry: Pick<QueueEntryRow, "name">): string {
  return `Hai ${entry.name}, kami menunggu tetapi tidak menemukan Anda. Nomor antrian Anda telah kedaluwarsa. Silakan daftar antrian lagi jika masih di dekat sini.`;
}

async function updateNotification(
  entry: QueueEntryRow,
  state: QueueNotificationState,
  message: string,
): Promise<QueueEntryRow> {
  const admin = createAdminClient();
  logWhatsAppMock(entry.phone, message);

  const patch: Pick<QueueEntryRow, "notification_state" | "pending_wa_url"> = {
    notification_state: state,
    pending_wa_url: entry.phone ? generateWhatsAppUrl(entry.phone, message) : null,
  };

  const { data, error } = await admin
    .from("queue_entries")
    .update(patch)
    .eq("id", entry.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as QueueEntryRow;
}

function listWithPosition(entries: QueueEntryRow[]): QueueListItem[] {
  const waiting = entries.filter((entry) => entry.status === "waiting");
  const waitingPositionById = new Map(
    waiting.map((entry, idx) => [entry.id, idx + 1]),
  );

  const active = entries.filter((entry) => STATUS_ACTIVE.includes(entry.status));
  const queueNumberById = new Map(active.map((entry, idx) => [entry.id, idx + 1]));

  return entries.map((entry, idx) => ({
    ...entry,
    queue_number: queueNumberById.get(entry.id) ?? idx + 1,
    position: waitingPositionById.get(entry.id) ?? 0,
  }));
}

export async function createQueueEntry(
  input: QueueCreateInput,
): Promise<{ token: string; position: number }> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nama minimal 2 karakter");
  if (input.party_size < 1 || input.party_size > 20) {
    throw new Error("Jumlah orang harus antara 1 dan 20");
  }

  const phone = normalizePhone(input.phone);
  const restaurant = await getOrCreateRestaurant();
  const admin = createAdminClient();

  const waitingInStore = input.waiting_in_store ?? false;
  const partyHasInfant = input.party_has_infant ?? false;
  const partyHasElderly = input.party_has_elderly ?? false;
  const partyHasChild = input.party_has_child ?? false;

  let inserted: QueueEntryRow | null = null;
  for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
    const token = generateQueueToken(12);
    const { data, error } = await admin
      .from("queue_entries")
      .insert({
        restaurant_id: restaurant.id,
        name,
        party_size: input.party_size,
        phone,
        token,
        status: "waiting",
        notification_state: "none",
        waiting_in_store: waitingInStore,
        party_has_infant: partyHasInfant,
        party_has_elderly: partyHasElderly,
        party_has_child: partyHasChild,
      })
      .select("*")
      .single();
    if (!error) {
      inserted = rowDefaults(data as QueueEntryRow);
      break;
    }
    if (!error.message.toLowerCase().includes("token")) {
      throw new Error(error.message);
    }
  }
  if (!inserted) throw new Error("Gagal membuat token antrian unik");

  const position = await computeWaitingPosition(
    inserted.restaurant_id,
    inserted.created_at,
  );
  const withNotif =
    inserted.notification_state === "joined"
      ? inserted
      : await updateNotification(
          inserted,
          "joined",
          buildJoinMessage(inserted, position, restaurant.name),
        );

  return { token: withNotif.token, position };
}

export async function getQueueEntryByToken(token: string): Promise<QueueListItem | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const entry = rowDefaults(data as QueueEntryRow);
  const position = await computeWaitingPosition(entry.restaurant_id, entry.created_at);
  const queueNumber = await computeActiveQueueNumber(entry.restaurant_id, entry.created_at);

  return {
    ...entry,
    queue_number: queueNumber,
    position: entry.status === "waiting" ? position : 0,
  };
}

export async function listQueueEntries(): Promise<{
  restaurant_name: string;
  entries: QueueListItem[];
}> {
  const restaurant = await getOrCreateRestaurant();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .in("status", STATUS_ACTIVE)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    restaurant_name: restaurant.name,
    entries: listWithPosition((data ?? []).map((r) => rowDefaults(r as QueueEntryRow))),
  };
}

// Host floor-plan view: includes seated rows so the host can see who's at
// which table, plus a list of tables whose order has already been paid
// (tables_needing_cleanup) so they can be highlighted as "siap dibersihkan".
export async function listHostFloorState(): Promise<{
  restaurant_name: string;
  entries: QueueListItem[];
  tables_needing_cleanup: string[];
}> {
  const restaurant = await getOrCreateRestaurant();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .in("status", STATUS_ON_FLOOR)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => rowDefaults(r as QueueEntryRow));
  const seatedTables = rows
    .filter((r) => r.status === "seated" && r.assigned_table)
    .map((r) => r.assigned_table as string);

  let needingCleanup: string[] = [];
  if (seatedTables.length > 0) {
    const { data: paidOrders, error: ordErr } = await admin
      .from("orders")
      .select("table_number")
      .eq("payment_status", "paid")
      .in("table_number", seatedTables);
    if (ordErr) throw new Error(ordErr.message);
    needingCleanup = Array.from(
      new Set(
        (paidOrders ?? [])
          .map((r) => (r as { table_number: string | null }).table_number)
          .filter((t): t is string => Boolean(t)),
      ),
    );
  }

  return {
    restaurant_name: restaurant.name,
    entries: listWithPosition(rows),
    tables_needing_cleanup: needingCleanup,
  };
}

async function getQueueById(id: string): Promise<QueueEntryRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as QueueEntryRow | null;
  return row ? rowDefaults(row) : null;
}

const PRESENCE_ALLOWED: QueueEntryStatus[] = ["waiting", "called"];

export async function setWaitingInStoreByToken(
  token: string,
  waitingInStore: boolean,
): Promise<TransitionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  const entry = rowDefaults(data as QueueEntryRow);
  if (!PRESENCE_ALLOWED.includes(entry.status)) {
    return {
      ok: false,
      code: 400,
      error: "Status kehadiran hanya bisa diubah saat masih menunggu atau dipanggil",
    };
  }

  const { data: updated, error: updateErr } = await admin
    .from("queue_entries")
    .update({ waiting_in_store: waitingInStore })
    .eq("id", entry.id)
    .select("*")
    .single();
  if (updateErr) return { ok: false, code: 400, error: updateErr.message };
  return { ok: true, entry: rowDefaults(updated as QueueEntryRow) };
}

export async function setWaitingInStoreById(
  id: string,
  waitingInStore: boolean,
): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (!PRESENCE_ALLOWED.includes(entry.status)) {
    return {
      ok: false,
      code: 400,
      error: "Status kehadiran hanya bisa diubah saat masih menunggu atau dipanggil",
    };
  }

  const admin = createAdminClient();
  const { data: updated, error: updateErr } = await admin
    .from("queue_entries")
    .update({ waiting_in_store: waitingInStore })
    .eq("id", id)
    .select("*")
    .single();
  if (updateErr) return { ok: false, code: 400, error: updateErr.message };
  return { ok: true, entry: rowDefaults(updated as QueueEntryRow) };
}

async function ensureTopWaiting(entry: QueueEntryRow): Promise<TransitionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .select("id")
    .eq("restaurant_id", entry.restaurant_id)
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { ok: false, code: 400, error: error.message };
  }
  if (!data || data.id !== entry.id) {
    return {
      ok: false,
      code: 409,
      error: "Hanya antrian pertama yang menunggu yang bisa dipanggil",
    };
  }
  return { ok: true, entry };
}

export async function cancelByToken(token: string): Promise<TransitionResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  const entry = data as QueueEntryRow;
  if (entry.status === "cancelled") return { ok: true, entry };
  if (entry.status !== "waiting") {
    return { ok: false, code: 400, error: "Hanya yang masih menunggu yang bisa dibatalkan" };
  }

  const { data: updated, error: updateErr } = await admin
    .from("queue_entries")
    .update({ status: "cancelled", pending_wa_url: null })
    .eq("id", entry.id)
    .select("*")
    .single();
  if (updateErr) return { ok: false, code: 400, error: updateErr.message };
  return { ok: true, entry: updated as QueueEntryRow };
}

export async function callNextById(id: string): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (entry.status === "called") return { ok: true, entry };
  if (entry.status !== "waiting") {
    return { ok: false, code: 400, error: "Hanya yang menunggu yang bisa dipanggil" };
  }

  const topCheck = await ensureTopWaiting(entry);
  if (!topCheck.ok) return topCheck;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({ status: "called", called_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "waiting")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) {
    const retry = await getQueueById(id);
    if (!retry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
    if (retry.status === "called") return { ok: true, entry: retry };
    return { ok: false, code: 400, error: "Gagal mengubah status menjadi dipanggil" };
  }

  const calledEntry = data as QueueEntryRow;
  if (calledEntry.notification_state === "called") {
    return { ok: true, entry: calledEntry };
  }

  const restaurant = await getOrCreateRestaurant();
  const notified = await updateNotification(
    calledEntry,
    "called",
    buildCalledMessage(calledEntry, restaurant.name),
  );
  return { ok: true, entry: notified };
}

export async function seatById(id: string, tableNumber: string): Promise<TransitionResult> {
  const cleanTable = tableNumber.trim();
  if (!cleanTable) {
    return { ok: false, code: 400, error: "Nomor meja wajib diisi" };
  }

  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (entry.status === "seated") return { ok: true, entry };
  if (entry.status !== "called") {
    return { ok: false, code: 400, error: "Hanya yang sudah dipanggil yang bisa didaftarkan duduk" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({
      status: "seated",
      assigned_table: cleanTable,
      seated_at: new Date().toISOString(),
      pending_wa_url: null,
    })
    .eq("id", id)
    .eq("status", "called")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) {
    const retry = await getQueueById(id);
    if (retry?.status === "seated") return { ok: true, entry: retry };
    return { ok: false, code: 400, error: "Gagal mengubah status menjadi sudah duduk" };
  }
  return { ok: true, entry: data as QueueEntryRow };
}

async function markNoShow(id: string): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (entry.status === "no_show") return { ok: true, entry };
  if (entry.status !== "called") {
    return { ok: false, code: 400, error: "Hanya yang sudah dipanggil yang bisa ditandai tidak hadir" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({ status: "no_show" })
    .eq("id", id)
    .eq("status", "called")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) {
    const retry = await getQueueById(id);
    if (retry?.status === "no_show") return { ok: true, entry: retry };
    return { ok: false, code: 400, error: "Gagal mengubah status menjadi tidak hadir" };
  }

  const noShowEntry = data as QueueEntryRow;
  if (noShowEntry.notification_state === "no_show") {
    return { ok: true, entry: noShowEntry };
  }

  const notified = await updateNotification(
    noShowEntry,
    "no_show",
    buildNoShowMessage(noShowEntry),
  );
  return { ok: true, entry: notified };
}

export async function noShowById(id: string): Promise<TransitionResult> {
  return markNoShow(id);
}

export async function cancelByHost(id: string): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (entry.status === "cancelled") return { ok: true, entry };
  if (entry.status !== "waiting") {
    return { ok: false, code: 400, error: "Hanya yang masih menunggu yang bisa dibatalkan" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({ status: "cancelled", pending_wa_url: null })
    .eq("id", id)
    .eq("status", "waiting")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) {
    const retry = await getQueueById(id);
    if (retry?.status === "cancelled") return { ok: true, entry: retry };
    return { ok: false, code: 400, error: "Gagal membatalkan entri antrian" };
  }
  return { ok: true, entry: data as QueueEntryRow };
}

export async function completeSeatedById(id: string): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (entry.status === "completed") return { ok: true, entry };
  if (entry.status !== "seated") {
    return {
      ok: false,
      code: 400,
      error: "Hanya tamu yang sudah duduk yang bisa ditandai selesai",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({ status: "completed", pending_wa_url: null })
    .eq("id", id)
    .eq("status", "seated")
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, code: 400, error: error.message };
  if (!data) {
    const retry = await getQueueById(id);
    if (retry?.status === "completed") return { ok: true, entry: retry };
    return { ok: false, code: 400, error: "Gagal menandai entri selesai" };
  }
  return { ok: true, entry: rowDefaults(data as QueueEntryRow) };
}

export async function markWhatsAppDelivered(id: string): Promise<TransitionResult> {
  const entry = await getQueueById(id);
  if (!entry) return { ok: false, code: 404, error: "Entri antrian tidak ditemukan" };
  if (!entry.pending_wa_url) return { ok: true, entry };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("queue_entries")
    .update({ pending_wa_url: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return { ok: false, code: 400, error: error.message };
  return { ok: true, entry: data as QueueEntryRow };
}

export async function autoExpireCalledEntries(): Promise<{
  ok: true;
  updated: number;
} | {
  ok: false;
  error: string;
}> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await admin
      .from("queue_entries")
      .select("id")
      .eq("status", "called")
      .lt("called_at", cutoff);
    if (error) return { ok: false, error: error.message };

    const rows = data ?? [];
    for (const row of rows) {
      await markNoShow(row.id as string);
    }
    return { ok: true, updated: rows.length };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

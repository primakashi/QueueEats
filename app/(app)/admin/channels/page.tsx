import { PageHeader } from "@/components/page-header";
import { requireRole, getRestaurantFilter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  OrderChannelConfig,
  PaymentMethodConfig,
  PaymentMethodWithProviders,
  PaymentProviderConfig,
  Restaurant,
} from "@/lib/types";
import { SaluranPembayaran } from "./saluran-pembayaran";

export default async function AdminChannelsPage() {
  const profile = await requireRole(["admin", "owner"]);
  const supabase = await createClient();
  const rid = getRestaurantFilter(profile);

  let channelsQ = supabase.from("order_channels").select("*");
  if (rid) channelsQ = channelsQ.eq("restaurant_id", rid);

  let methodsQ = supabase.from("payment_methods").select("*");
  if (rid) methodsQ = methodsQ.eq("restaurant_id", rid);

  let providersQ = supabase.from("payment_providers").select("*");
  if (rid) providersQ = providersQ.eq("restaurant_id", rid);

  const restaurantQ = rid
    ? supabase.from("restaurants").select("*").eq("id", rid).maybeSingle()
    : null;

  const [{ data: channelsRaw }, { data: methodsRaw }, { data: providersRaw }, restaurantRes] = await Promise.all([
    channelsQ.order("sort_order", { ascending: true }),
    methodsQ.order("sort_order", { ascending: true }),
    providersQ.order("sort_order", { ascending: true }),
    restaurantQ,
  ]);

  const channels = (channelsRaw ?? []) as OrderChannelConfig[];
  const methods = (methodsRaw ?? []) as PaymentMethodConfig[];
  const providers = (providersRaw ?? []) as PaymentProviderConfig[];
  const restaurant = (restaurantRes?.data ?? null) as Restaurant | null;

  const methodsWithProviders: PaymentMethodWithProviders[] = methods.map((m) => ({
    ...m,
    providers: providers
      .filter((p) => p.payment_method_id === m.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        title="Saluran & Pembayaran"
        description="Kelola saluran pesanan, metode pembayaran, pajak, dan biaya layanan."
      />
      <SaluranPembayaran
        channels={channels}
        methods={methodsWithProviders}
        restaurant={restaurant}
      />
    </div>
  );
}

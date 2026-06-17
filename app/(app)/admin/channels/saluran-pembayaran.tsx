"use client";

import { useState } from "react";
import { Radio, CreditCard, Receipt } from "lucide-react";
import type {
  OrderChannelConfig,
  PaymentMethodWithProviders,
  Restaurant,
} from "@/lib/types";
import { ChannelsManager } from "./channels-manager";
import { PaymentMethodsManager } from "./payment-methods-manager";
import { TaxServiceManager } from "./tax-service-manager";

type Tab = "channels" | "payments" | "tax";

export function SaluranPembayaran({
  channels,
  methods,
  restaurant,
}: {
  channels: OrderChannelConfig[];
  methods: PaymentMethodWithProviders[];
  restaurant: Restaurant | null;
}) {
  const [tab, setTab] = useState<Tab>("channels");

  const channelCount = channels.length;
  const methodCount = methods.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b -mx-1 px-1">
        <TabButton active={tab === "channels"} onClick={() => setTab("channels")}>
          <Radio className="size-4" />
          <span>Saluran Pesanan</span>
          <Count value={channelCount} active={tab === "channels"} />
        </TabButton>
        <TabButton active={tab === "payments"} onClick={() => setTab("payments")}>
          <CreditCard className="size-4" />
          <span>Metode Pembayaran</span>
          <Count value={methodCount} active={tab === "payments"} />
        </TabButton>
        <TabButton active={tab === "tax"} onClick={() => setTab("tax")}>
          <Receipt className="size-4" />
          <span>Pajak & Layanan</span>
        </TabButton>
      </div>

      {tab === "channels" && <ChannelsManager channels={channels} />}
      {tab === "payments" && <PaymentMethodsManager methods={methods} />}
      {tab === "tax" && <TaxServiceManager restaurant={restaurant} channels={channels} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors " +
        (active
          ? "text-foreground border-b-2 border-foreground -mb-px"
          : "text-muted-foreground hover:text-foreground border-b-2 border-transparent -mb-px")
      }
    >
      {children}
    </button>
  );
}

function Count({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={
        "ml-1 inline-flex items-center justify-center min-w-5 h-5 rounded-full px-1.5 text-[10px] font-semibold " +
        (active ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
      }
    >
      {value}
    </span>
  );
}

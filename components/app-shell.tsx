"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  CreditCard,
  LogOut,
  Radio,
  Scale,
  Menu as MenuIcon,
  Tag,
  UtensilsCrossed,
  Users,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SolusiSajiMark } from "@/components/solusi-saji-mark";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { Profile, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";

type NavSection = "Operasional" | "Katalog & Promosi" | "Administrasi" | "Manajemen";

type NavItem = {
  section: NavSection;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const NAV_SECTION_ORDER: NavSection[] = [
  "Operasional",
  "Katalog & Promosi",
  "Administrasi",
  "Manajemen",
];

/** Nav targets that use `loading.tsx` in-page instead of a sidebar link spinner. */
const NAV_IN_PAGE_LOADING_HREFS = new Set(["/admin/users", "/admin/sales", "/admin/outlets", "/admin/reconciliation", "/admin/channels", "/admin/log", "/admin/discounts", "/admin/stok"]);

// Per access matrix: cashier and waiter both get the broader "Kasir + Waitress" access.
const OPS_ROLES: UserRole[] = ["admin", "branch_manager", "cashier", "waiter"];
const CATALOG_ROLES: UserRole[] = ["admin", "branch_manager", "cashier", "waiter"];

const NAV_ITEMS: NavItem[] = [
  // Operasional
  // { section: "Operasional", href: "/host", label: "Antrean", icon: Users, roles: OPS_ROLES },
  { section: "Operasional", href: "/waiter", label: "Pesanan", icon: ClipboardList, roles: OPS_ROLES },
  { section: "Operasional", href: "/kitchen", label: "Dapur", icon: ChefHat, roles: [...OPS_ROLES, "kitchen"] },
  { section: "Operasional", href: "/cashier", label: "Kasir", icon: CreditCard, roles: OPS_ROLES },

  // Katalog & Promosi
  { section: "Katalog & Promosi", href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, roles: CATALOG_ROLES },
  { section: "Katalog & Promosi", href: "/admin/discounts", label: "Diskon", icon: Tag, roles: [...CATALOG_ROLES, "owner"] },
  { section: "Katalog & Promosi", href: "/admin/stok", label: "Stok", icon: Boxes, roles: [...CATALOG_ROLES, "kitchen"] },

  // Administrasi
  { section: "Administrasi", href: "/admin/users", label: "Staf", icon: Users, roles: ["admin", "owner", "branch_manager"] },
  { section: "Administrasi", href: "/admin/outlets", label: "Outlet", icon: Building2, roles: ["admin", "owner"] },
  { section: "Administrasi", href: "/admin/channels", label: "Kanal & Pembayaran", icon: Radio, roles: ["admin", "owner"] },
  { section: "Administrasi", href: "/admin/log", label: "Log", icon: ScrollText, roles: ["admin", "owner", "finance", "branch_manager"] },

  // Manajemen
  { section: "Manajemen", href: "/admin/sales", label: "Penjualan", icon: BarChart3, roles: ["admin", "owner", "finance", "branch_manager", "cashier", "waiter"] },
  { section: "Manajemen", href: "/admin/reconciliation", label: "Rekonsiliasi", icon: Scale, roles: ["admin", "owner", "finance", "branch_manager"] },
];

export function AppShell({
  profile,
  restaurantName,
  children,
}: {
  profile: Profile;
  restaurantName: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const items = NAV_ITEMS.filter(
    (i) => profile.role === "super_admin" || i.roles.includes(profile.role),
  );
  return (
    <div className="flex flex-1 flex-col bg-muted/30">
      {/*
        Desktop/tablet sidebar is fixed-positioned so it is fully removed from
        the document flow. This avoids any flex stretch/sticky-height
        interactions (notably an iPad/Safari bug where a sticky `h-dvh` flex
        child blocks the document from scrolling) — the page is now just a
        normal scrolling document with left padding on lg+.
      */}
      <aside
        className={cn(
          "hidden border-r bg-background lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:overflow-y-auto",
          "lg:transition-[width] lg:duration-200 lg:ease-out",
          sidebarCollapsed ? "lg:w-20" : "lg:w-60",
        )}
      >
        <BrandHeader
          name={restaurantName}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <Nav items={items} collapsed={sidebarCollapsed} />
        <UserFooter profile={profile} collapsed={sidebarCollapsed} />
        <BrandAttribution collapsed={sidebarCollapsed} />
      </aside>

      <div
        className={cn(
          "flex flex-1 min-w-0 flex-col lg:transition-[padding-left] lg:duration-200 lg:ease-out",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-60",
        )}
      >
        <header className="lg:hidden sticky top-0 z-40 flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-4 py-3">
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Buka menu"
                />
              }
            >
              <MenuIcon className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 flex flex-col">
              <BrandHeader name={restaurantName} />
              <Nav items={items} />
              <UserFooter profile={profile} />
              <BrandAttribution />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">{restaurantName}</span>
          <UserMenu profile={profile} />
        </header>

        <main className="flex-1 min-w-0 pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}

function BrandHeader({
  name,
  collapsed = false,
  onToggle,
}: {
  name: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        "h-16 shrink-0 border-b flex items-center",
        collapsed ? "justify-center px-2" : "justify-between gap-1 px-4",
      )}
    >
      <div className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "")}>
        {collapsed ? (
          <div
            className="h-9 w-9 rounded-md bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0"
            aria-label={name}
            title={name}
          >
            {(name?.trim()?.[0] ?? "?").toUpperCase()}
          </div>
        ) : (
          <div className="leading-tight min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
          </div>
        )}
      </div>
      {onToggle && (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
          className="shrink-0"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}

function Nav({
  items,
  collapsed = false,
}: {
  items: NavItem[];
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const sections = NAV_SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((i) => i.section === section),
  })).filter((s) => s.items.length > 0);

  return (
    <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-2 space-y-2" : "p-3 space-y-4")}>
      {sections.map(({ section, items: sectionItems }) => (
        <div key={section} className="space-y-1">
          {!collapsed && (
            <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section}
            </div>
          )}
          {sectionItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const showNavSpinner =
              !collapsed && !NAV_IN_PAGE_LOADING_HREFS.has(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {showNavSpinner && <NavLinkSpinner />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserFooter({
  profile,
  collapsed = false,
}: {
  profile: Profile;
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-t p-3",
        collapsed
          ? "flex justify-center"
          : "flex items-center justify-between gap-2",
      )}
    >
      {!collapsed && (
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{profile.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {ROLE_LABEL[profile.role]}
          </div>
        </div>
      )}
      <form action={signOut}>
        <SignOutIconButton />
      </form>
    </div>
  );
}

function BrandAttribution({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "border-t px-3 py-2 flex items-center",
        collapsed ? "justify-center" : "justify-center gap-2 text-[10px] text-muted-foreground",
      )}
    >
      {!collapsed && <span>Powered by</span>}
      <SolusiSajiMark className={cn("shrink-0 w-auto", collapsed ? "h-3.5" : "h-4")} />
    </div>
  );
}

function NavLinkSpinner() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      <Spinner size="xs" />
    </span>
  );
}


function SignOutIconButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="icon"
      aria-label="Keluar"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <Spinner /> : <LogOut className="h-4 w-4" />}
    </Button>
  );
}

function SignOutMenuItemContent() {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? (
        <Spinner className="mr-2" />
      ) : (
        <LogOut className="h-4 w-4 mr-2" />
      )}
      {pending ? "Keluar…" : "Keluar"}
    </>
  );
}

function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        {profile.full_name}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {profile.full_name} · {ROLE_LABEL[profile.role]}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem
            render={<button type="submit" className="w-full text-left" />}
          >
            <SignOutMenuItemContent />
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

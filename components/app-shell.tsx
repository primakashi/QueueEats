"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BarChart3,
  Building2,
  ChefHat,
  CreditCard,
  LogOut,
  Scale,
  Menu as MenuIcon,
  UtensilsCrossed,
  Users,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
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
import { cn } from "@/lib/utils";
import { signOut } from "@/app/login/actions";
import type { Profile, UserRole } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

/** Nav targets that use `loading.tsx` in-page instead of a sidebar link spinner. */
const NAV_IN_PAGE_LOADING_HREFS = new Set(["/admin/users", "/admin/sales", "/admin/outlets", "/admin/reconciliation"]);

const NAV_ITEMS: NavItem[] = [
  {
    href: "/waiter",
    label: "Pesanan",
    icon: ClipboardList,
    roles: ["waiter", "cashier", "admin"],
  },
  {
    href: "/host",
    label: "Antrean",
    icon: Users,
    roles: ["waiter", "admin"],
  },
  {
    href: "/kitchen",
    label: "Dapur",
    icon: ChefHat,
    roles: ["kitchen", "admin"],
  },
  {
    href: "/cashier",
    label: "Kasir",
    icon: CreditCard,
    roles: ["cashier", "admin"],
  },
  {
    href: "/admin/menu",
    label: "Menu",
    icon: UtensilsCrossed,
    roles: ["admin"],
  },
  {
    href: "/admin/users",
    label: "Staf",
    icon: Users,
    roles: ["admin"],
  },
  {
    href: "/admin/outlets",
    label: "Outlet",
    icon: Building2,
    roles: ["admin"],
  },
  {
    href: "/admin/sales",
    label: "Penjualan",
    icon: BarChart3,
    roles: ["admin", "owner"],
  },
  {
    href: "/admin/reconciliation",
    label: "Rekonsiliasi",
    icon: Scale,
    roles: ["admin", "owner"],
  },
];

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const items = NAV_ITEMS.filter((i) => i.roles.includes(profile.role));
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
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((prev) => !prev)}
        />
        <Nav items={items} collapsed={sidebarCollapsed} />
        <UserFooter profile={profile} collapsed={sidebarCollapsed} />
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
              <BrandHeader />
              <Nav items={items} />
              <UserFooter profile={profile} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Al Jazeerah Express</span>
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
  collapsed = false,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className={cn(
        "h-16 border-b",
        collapsed ? "px-2" : "px-5",
      )}
    >
      <div
        className={cn(
          "h-full flex items-center",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-2")}>
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-semibold">Al Jazeerah Express</div>
              <div className="text-xs text-muted-foreground">Titik penjualan</div>
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
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
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
  return (
    <nav className={cn("flex-1 space-y-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
      {items.map((item) => {
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
              collapsed
                ? "justify-center px-2"
                : "gap-3 px-3",
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

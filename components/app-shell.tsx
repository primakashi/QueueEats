"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  ChefHat,
  CreditCard,
  LogOut,
  Menu as MenuIcon,
  Settings,
  UtensilsCrossed,
  Users,
  ClipboardList,
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

const NAV_ITEMS: NavItem[] = [
  {
    href: "/waiter",
    label: "Pelayan",
    icon: ClipboardList,
    roles: ["waiter", "admin"],
  },
  {
    href: "/host",
    label: "Host",
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
    href: "/admin/categories",
    label: "Kategori",
    icon: Settings,
    roles: ["admin"],
  },
  {
    href: "/admin/users",
    label: "Staf",
    icon: Users,
    roles: ["admin"],
  },
];

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(profile.role));
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted/30 flex-1">
      <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col border-r bg-background">
        <BrandHeader />
        <Nav items={items} />
        <UserFooter profile={profile} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-4 py-3">
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
          <span className="font-semibold">QueueEats</span>
          <UserMenu profile={profile} />
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function BrandHeader() {
  return (
    <div className="h-16 px-5 flex items-center gap-2 border-b">
      <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
        <UtensilsCrossed className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <div className="font-semibold">QueueEats</div>
        <div className="text-xs text-muted-foreground">Titik penjualan</div>
      </div>
    </div>
  );
}

function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{item.label}</span>
            <NavLinkSpinner />
          </Link>
        );
      })}
    </nav>
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

function UserFooter({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{profile.full_name}</div>
        <div className="text-xs text-muted-foreground">
          {ROLE_LABEL[profile.role]}
        </div>
      </div>
      <form action={signOut}>
        <SignOutIconButton />
      </form>
    </div>
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

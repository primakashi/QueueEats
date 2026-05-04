"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ImageIcon, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/lib/types";

type Section = {
  id: string;
  name: string;
  items: MenuItem[];
};

const UNCATEGORIZED_ID = "__uncat__";

export function PublicMenu({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: MenuCategory[];
}) {
  const sections = useMemo<Section[]>(() => {
    const byCat = new Map<string, MenuItem[]>();
    for (const it of items) {
      const key = it.category_id ?? UNCATEGORIZED_ID;
      const list = byCat.get(key) ?? [];
      list.push(it);
      byCat.set(key, list);
    }
    const result: Section[] = [];
    for (const c of categories) {
      const list = byCat.get(c.id);
      if (list && list.length) {
        result.push({ id: c.id, name: c.name, items: list });
      }
    }
    const uncat = byCat.get(UNCATEGORIZED_ID);
    if (uncat && uncat.length) {
      result.push({ id: UNCATEGORIZED_ID, name: "Other", items: uncat });
    }
    return result;
  }, [items, categories]);

  const [activeId, setActiveId] = useState<string | null>(
    sections[0]?.id ?? null,
  );
  const [selected, setSelected] = useState<MenuItem | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const suppressObserverUntil = useRef<number>(0);

  const registerSection = useCallback(
    (id: string) => (node: HTMLElement | null) => {
      sectionRefs.current[id] = node;
    },
    [],
  );
  const registerTab = useCallback(
    (id: string) => (node: HTMLButtonElement | null) => {
      tabRefs.current[id] = node;
    },
    [],
  );

  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntil.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target.id) setActiveId(top.target.id);
      },
      {
        rootMargin: "-88px 0px -55% 0px",
        threshold: [0, 0.2, 0.5, 0.8, 1],
      },
    );
    sections.forEach((s) => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active tab scrolled into view inside the tab rail
  useEffect(() => {
    if (!activeId) return;
    const tab = tabRefs.current[activeId];
    const scroller = scrollerRef.current;
    if (!tab || !scroller) return;
    const tabRect = tab.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    if (tabRect.left < scRect.left + 12) {
      scroller.scrollBy({
        left: tabRect.left - scRect.left - 16,
        behavior: "smooth",
      });
    } else if (tabRect.right > scRect.right - 12) {
      scroller.scrollBy({
        left: tabRect.right - scRect.right + 16,
        behavior: "smooth",
      });
    }
  }, [activeId]);

  function jumpTo(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    // Temporarily ignore the IntersectionObserver so the smooth-scroll
    // doesn't fight with scroll-based activation
    suppressObserverUntil.current = Date.now() + 700;
    setActiveId(id);
    const y = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  if (sections.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          Menu is being prepared. Please check back soon.
        </div>
      </div>
    );
  }

  return (
    <>
      <nav
        aria-label="Menu sections"
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b"
      >
        <div className="max-w-5xl mx-auto">
          <div
            ref={scrollerRef}
            className="flex gap-1.5 overflow-x-auto py-2.5 sm:py-3 px-4 sm:px-5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {sections.map((s) => (
              <button
                key={s.id}
                ref={registerTab(s.id)}
                type="button"
                onClick={() => jumpTo(s.id)}
                className={cn(
                  "shrink-0 px-4 h-10 rounded-full text-sm font-medium border transition-colors touch-manipulation",
                  activeId === s.id
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-background hover:bg-muted text-muted-foreground",
                )}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-12">
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            ref={registerSection(s.id)}
            className="scroll-mt-20"
          >
            <h2 className="text-lg sm:text-2xl font-semibold tracking-tight mb-3 sm:mb-5">
              {s.name}
            </h2>
            <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((item) => (
                <MenuCard
                  key={item.id}
                  item={item}
                  onClick={() => setSelected(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-auto max-h-[92vh] p-0 rounded-t-2xl overflow-hidden flex flex-col sm:max-w-lg sm:left-1/2 sm:right-auto sm:bottom-6 sm:-translate-x-1/2 sm:rounded-2xl sm:border"
        >
          {selected && (
            <>
              <SheetTitle className="sr-only">{selected.name}</SheetTitle>
              <div className="relative aspect-[4/3] bg-muted shrink-0 overflow-hidden">
                {selected.image_url ? (
                  <SmartImage
                    src={selected.image_url}
                    alt={selected.name}
                    sizes="(max-width: 640px) 100vw, 512px"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-muted-foreground">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-3 right-3 rounded-full shadow-md h-10 w-10 bg-white/95 hover:bg-white text-foreground"
                  aria-label="Close"
                  onClick={() => setSelected(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-5 sm:p-6 space-y-3 overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xl font-semibold tracking-tight leading-tight">
                    {selected.name}
                  </h3>
                  <div className="shrink-0 text-lg font-semibold tabular-nums">
                    {formatIDR(selected.price)}
                  </div>
                </div>
                {selected.description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {selected.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function MenuCard({
  item,
  onClick,
}: {
  item: MenuItem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-xl border bg-card overflow-hidden hover:shadow-md active:scale-[0.99] transition touch-manipulation"
    >
      {/* Mobile: horizontal layout for density; desktop: vertical with big image */}
      <div className="flex sm:block">
        <div className="relative h-28 w-28 shrink-0 bg-muted overflow-hidden sm:h-auto sm:w-full sm:aspect-[4/3]">
          {item.image_url ? (
            <SmartImage
              src={item.image_url}
              alt={item.name}
              sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground">
              <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8" />
            </div>
          )}
        </div>
        <div className="flex-1 p-3 sm:p-4 min-w-0 flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="font-medium leading-tight line-clamp-2">
              {item.name}
            </h3>
            {item.description && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <div className="mt-2 font-semibold tabular-nums text-sm sm:text-base">
            {formatIDR(item.price)}
          </div>
        </div>
      </div>
    </button>
  );
}

function SmartImage({
  src,
  alt,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-[linear-gradient(110deg,var(--muted)_20%,color-mix(in_oklab,var(--muted)_60%,white)_40%,var(--muted)_60%)] bg-[length:200%_100%] transition-opacity duration-300",
          loaded ? "opacity-0 animate-none" : "opacity-100 animate-[shimmer_1.4s_infinite_linear]",
        )}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          "object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  );
}

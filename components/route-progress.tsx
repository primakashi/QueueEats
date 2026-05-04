"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Module-scoped references set by the mounted RouteProgress component, so that
// imperative navigations (e.g. router.push after a server action) can also
// flip the top progress bar on/off without going through an anchor click.
let externalStart: (() => void) | null = null;
let externalEnd: (() => void) | null = null;

/**
 * Trigger the global top progress bar from anywhere in the app.
 * Safe to call when no <RouteProgress /> is mounted (no-op).
 */
export function startRouteProgress() {
  externalStart?.();
}

/**
 * Force the global top progress bar off (e.g. when a server action errors out
 * and we did not actually navigate). Safe to call as a no-op.
 */
export function endRouteProgress() {
  externalEnd?.();
}

export function RouteProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  // Track previous pathname in render to clear pending without an effect.
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [trackedPath, setTrackedPath] = useState(pathname);
  if (pathname !== trackedPath) {
    setTrackedPath(pathname);
    if (pending) setPending(false);
  }

  // Capture clicks on any internal anchor and start the bar.
  // We use the capture phase so we run before Next.js' own click handler.
  useEffect(() => {
    function isModified(e: MouseEvent) {
      return (
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      );
    }

    function onClick(e: MouseEvent) {
      if (isModified(e)) return;
      const a = (e.target as Element | null)?.closest("a");
      if (!a) return;

      const href = a.getAttribute("href");
      if (!href) return;
      // Skip hash, mailto:, tel:, external schemes, downloads, new-tab
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        a.hasAttribute("download") ||
        a.target === "_blank"
      ) {
        return;
      }
      // Skip cross-origin
      if (a.host && a.host !== window.location.host) return;
      // Same URL → no nav
      if (
        a.pathname === window.location.pathname &&
        a.search === window.location.search
      ) {
        return;
      }

      setPending(true);
    }

    document.addEventListener("click", onClick, { capture: true });
    externalStart = () => setPending(true);
    externalEnd = () => setPending(false);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      externalStart = null;
      externalEnd = null;
    };
  }, []);

  // Safety net: if a navigation never resolves (e.g. blocked), clear after a while.
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => setPending(false), 8000);
    return () => window.clearTimeout(t);
  }, [pending]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 right-0 z-[100] h-0.5"
    >
      <div
        className={
          "h-full origin-left bg-primary transition-[transform,opacity] ease-out " +
          (pending
            ? "animate-[route-progress_1.4s_ease-in-out_infinite] opacity-100"
            : "scale-x-0 opacity-0 duration-200")
        }
      />
    </div>
  );
}

// Wraps a server-action call so a thrown exception (network blip, missing
// env, unexpected RPC error) becomes a regular `{ ok:false }` result with a
// user-friendly message instead of bubbling to the nearest error boundary
// and crashing the whole page/board.

import { toast } from "sonner";

type FailResult = { ok: false; error: string };

export async function safeAction<T extends { ok: boolean }>(
  fn: () => Promise<T>,
  opts: { fallback?: string; context?: string } = {},
): Promise<T | FailResult> {
  try {
    return await fn();
  } catch (err) {
    const ctx = opts.context ?? "action";
    console.error(`[safeAction:${ctx}] threw`, err);
    const fallback = opts.fallback ?? "Terjadi kesalahan. Coba lagi.";
    return { ok: false, error: fallback };
  }
}

// Convenience that also shows a toast on failure. Returns the action result
// (or { ok:false, error }) so the caller can decide what to do next.
export async function runAction<T extends { ok: boolean; error?: string }>(
  fn: () => Promise<T>,
  opts: { fallback?: string; context?: string } = {},
): Promise<T | FailResult> {
  const result = await safeAction(fn, opts);
  if (!result.ok) {
    toast.error(result.error ?? opts.fallback ?? "Terjadi kesalahan. Coba lagi.");
  }
  return result;
}

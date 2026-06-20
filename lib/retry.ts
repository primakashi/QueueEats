// Small helper for read-after-write reads where the row was just created
// elsewhere and a transient Supabase blip or read replica lag could return
// null on the first try. Retries once after a short delay. Distinguish
// "actual missing" (data null + no error) from "transient failure" (error)
// — callers should treat the latter as a real error, not a 404.

export type ReadResult<T> = { data: T | null; error: { message: string } | null };

// Accept any thenable (Supabase's PostgrestBuilder is a thenable, not a real
// Promise — `await` resolves it, but the type doesn't satisfy `Promise<T>`).
type Thenable<T> = PromiseLike<T>;

export async function readWithRetry<T>(
  fn: () => Thenable<ReadResult<T>>,
  opts: { retries?: number; delayMs?: number } = {},
): Promise<ReadResult<T>> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 250;
  let last: ReadResult<T> = { data: null, error: null };
  for (let i = 0; i <= retries; i++) {
    last = await fn();
    // If we got data or got a real error (not just empty), return immediately.
    if (last.data != null || last.error != null) return last;
    // Empty result — small delay and retry once.
    if (i < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return last;
}

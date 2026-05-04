import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// supabase-js only calls realtime.setAuth() on SIGNED_IN / TOKEN_REFRESHED.
// On a fresh page load with an existing cookie session the event is
// INITIAL_SESSION, so the websocket would otherwise connect with just the
// publishable key — and RLS-protected postgres_changes get filtered out.
export async function createRealtimeClient() {
  const client = createClient();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (session?.access_token) {
    await client.realtime.setAuth(session.access_token);
  }
  return client;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isQueuePublicPage =
    pathname === "/queue" ||
    pathname === "/queue/join" ||
    /^\/queue\/[^/]+$/.test(pathname);
  const isQueuePublicApi =
    pathname === "/api/queue" ||
    pathname === "/api/queue/list" ||
    /^\/api\/queue\/[^/]+$/.test(pathname) ||
    /^\/api\/queue\/[^/]+\/cancel$/.test(pathname);
  const isPublicRoute =
    isAuthRoute ||
    pathname === "/" ||
    pathname === "/menu" ||
    pathname.startsWith("/menu/") ||
    pathname.startsWith("/pay/") ||
    isQueuePublicPage ||
    isQueuePublicApi ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/xendit") ||
    pathname === "/favicon.ico";

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

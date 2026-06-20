import { NextResponse, type NextRequest } from "next/server";
import { PROFILE_COOKIE } from "@/lib/auth";

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/login")) return true;
  if (pathname === "/") return true;
  if (pathname === "/menu" || pathname.startsWith("/menu/")) return true;
  if (pathname.startsWith("/pay/")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/xendit")) return true;
  if (pathname === "/favicon.ico") return true;

  // Public queue surfaces
  if (pathname === "/queue" || pathname === "/queue/join") return true;
  if (/^\/queue\/[^/]+$/.test(pathname)) return true;
  if (pathname === "/api/queue" || pathname === "/api/queue/list") return true;
  if (/^\/api\/queue\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/queue\/[^/]+\/cancel$/.test(pathname)) return true;

  return false;
}

// Pure cookie-gate middleware: no network. Supabase JWT refresh happens
// inside @supabase/ssr clients on demand during actual queries, and RLS
// enforces real authorization. The qe_profile cookie is httpOnly+secure
// and only set after a successful login, so its presence is a sufficient
// "is logged in" hint for routing.
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request });
  }

  if (!request.cookies.get(PROFILE_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

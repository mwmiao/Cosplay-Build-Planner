import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: is there a session cookie at all? Every page, action
// and API route validates the session against the database itself
// (lib/auth.ts), so this never decides access on its own.
const SESSION_COOKIES = ["cbp.session_token", "__Secure-cbp.session_token"];

const PUBLIC_PAGES = /^\/(login|register|forgot-password|reset-password|community|events)(\/|$)/;
const PUBLIC_API = /^\/api\/(health|community)(\/|$)/;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Projects is the main page; visitors without an account get a start page there.
  if (pathname === "/projects" || PUBLIC_PAGES.test(pathname) || PUBLIC_API.test(pathname)) return NextResponse.next();
  if (SESSION_COOKIES.some((name) => req.cookies.has(name))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/projects";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Not the image upload route: when middleware runs on a POST, Next.js holds
  // the whole body in memory until it has all arrived, before the route can
  // refuse an oversized upload. The route checks the session itself.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|manifest.webmanifest|api/projects/[^/]+/references).*)"],
};

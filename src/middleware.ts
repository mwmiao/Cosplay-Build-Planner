import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: is there a session cookie at all? Every page, action
// and API route validates the session against the database itself
// (lib/auth.ts), so this never decides access on its own.
const SESSION_COOKIES = ["cbp.session_token", "__Secure-cbp.session_token"];

const PUBLIC_PAGES = /^\/(login|register|forgot-password|reset-password|community|events)(\/|$)/;
const PUBLIC_API = /^\/api\/(health|community)(\/|$)/;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PAGES.test(pathname) || PUBLIC_API.test(pathname)) return NextResponse.next();
  if (SESSION_COOKIES.some((name) => req.cookies.has(name))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|manifest.webmanifest).*)"],
};

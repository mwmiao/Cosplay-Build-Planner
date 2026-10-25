import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifySessionToken } from "@/lib/session";

export async function middleware(req: NextRequest) {
  // No password configured: login is turned off.
  if (!process.env.APP_PASSWORD?.trim()) return NextResponse.next();
  const ok = await verifySessionToken(
    req.cookies.get(SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
  if (ok) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, health check and static assets.
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};

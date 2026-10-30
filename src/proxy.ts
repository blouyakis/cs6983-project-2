import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/http/errors";

const AUTH_PAGES = ["/login", "/register"];

// A convenience redirect for pages, not the security boundary: route
// handlers and pages check the session again themselves.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const signedIn = await hasValidSession(token);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (signedIn && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (!signedIn && !isAuthPage) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    if (token) {
      login.searchParams.set("expired", "1");
    }
    const response = NextResponse.redirect(login);
    if (token) {
      clearSessionCookie(response);
    }
    return response;
  }
  return NextResponse.next();
}

async function hasValidSession(token: string | undefined): Promise<boolean> {
  try {
    await verifySession(token);
    return true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return false;
    }
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

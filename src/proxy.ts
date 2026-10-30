import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { UnauthorizedError, toErrorResponse } from "@/lib/http/errors";

const AUTH_PAGES = ["/login", "/register"];
// The only API routes that work without a session.
const PUBLIC_API_ROUTES = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
];

// A first check, not the security boundary: route handlers and pages check
// the session again themselves.
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }
  const rejection = await checkSession(token);
  const signedIn = rejection === null;

  // API clients get the 401 error body from the OpenAPI spec, not a redirect.
  if (pathname.startsWith("/api/")) {
    return signedIn ? NextResponse.next() : toErrorResponse(rejection);
  }

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

// Returns why the session is not valid, or null when it is.
async function checkSession(
  token: string | undefined,
): Promise<UnauthorizedError | null> {
  try {
    await verifySession(token);
    return null;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return error;
    }
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};

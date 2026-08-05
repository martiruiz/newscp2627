import { NextRequest, NextResponse } from "next/server";

const COOKIE = "scp_admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const session = request.cookies.get(COOKIE)?.value;

    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Session value is stored as "userId:ROLE_XXX" — require ROLE_SUPERADMIN
    const role = session.split(":")[1];
    if (role !== "ROLE_SUPERADMIN") {
      return NextResponse.redirect(new URL("/admin/login?error=unauthorized", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { accessFor, landingFor } from "./lib/access";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const access = accessFor(pathname);
  if (access === "public") return;

  const user = req.auth?.user;
  const isApi = pathname.startsWith("/api/");

  if (!user?.role) {
    if (isApi) return NextResponse.json({ error: "UNAUTHENTICATED", message: "Please log in." }, { status: 401 });
    const loginPath = pathname.startsWith("/staff") ? "/staff/login" : "/login";
    const url = new URL(loginPath, req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(url);
  }

  if (access !== "any" && !access.includes(user.role)) {
    if (isApi) return NextResponse.json({ error: "FORBIDDEN", message: "Not allowed." }, { status: 403 });
    return NextResponse.redirect(new URL(landingFor(user.role), req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|mp3)$).*)"],
};

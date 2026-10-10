import type { NextAuthConfig } from "next-auth";

// Edge-safe part of the Auth.js config (used by middleware). Providers live in auth.ts.
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.userId && token.role) {
        session.user.userId = token.userId;
        session.user.role = token.role;
        session.user.canteenId = token.canteenId ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { rpc } from "./lib/db";
import { env, isDemoMode } from "./lib/env";
import { isCollegeEmail, isRole } from "./lib/access";
import type { Profile } from "./lib/types";

function toUser(p: Profile | undefined) {
  if (!p || !isRole(p.role)) return null;
  return { id: p.id, name: p.full_name, email: p.email, role: p.role, canteenId: p.canteen_id };
}

const idCardSchema = z.object({ code: z.string().trim().min(16).max(128) });
const demoSchema = z.object({ role: z.enum(["student", "food_server", "cashier"]) });

const domain = env.collegeDomain();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      authorization: { params: { prompt: "select_account", ...(domain ? { hd: domain } : {}) } },
    }),
    // The QR on an ID card encodes the profile's id_card_code.
    Credentials({
      id: "idcard",
      name: "ID card QR",
      credentials: { code: { label: "ID card code", type: "text" } },
      async authorize(raw) {
        const parsed = idCardSchema.safeParse(raw);
        if (!parsed.success) return null;
        const rows = await rpc<Profile[]>("profile_by_id_card", { p_code: parsed.data.code });
        return toUser(rows[0]);
      },
    }),
    // Demo buttons. Refuses to work unless DEMO_MODE=true.
    Credentials({
      id: "demo",
      name: "Demo login",
      credentials: { role: { label: "Role", type: "text" } },
      async authorize(raw) {
        if (!isDemoMode()) return null;
        const parsed = demoSchema.safeParse(raw);
        if (!parsed.success) return null;
        const rows = await rpc<Profile[]>("demo_profile", { p_role: parsed.data.role });
        return toUser(rows[0]);
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    signIn({ account, profile }) {
      if (account?.provider === "google") {
        return profile?.email_verified !== false && isCollegeEmail(profile?.email, env.collegeDomain());
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const p = await rpc<Profile>("get_or_create_google_profile", {
          p_email: profile.email,
          p_name: profile.name ?? "",
        });
        token.userId = p.id;
        token.role = p.role;
        token.canteenId = p.canteen_id;
        token.name = p.full_name;
      } else if (user?.id && user.role) {
        token.userId = user.id;
        token.role = user.role;
        token.canteenId = user.canteenId ?? null;
      }
      return token;
    },
  },
});

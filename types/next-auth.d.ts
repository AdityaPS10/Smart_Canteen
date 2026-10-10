import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/access";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      role: Role;
      canteenId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
    canteenId?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    canteenId?: string | null;
  }
}

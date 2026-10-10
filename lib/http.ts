import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import { AppError } from "./errors";
import { env } from "./env";
import type { Role } from "./access";

export interface SessionUser {
  userId: string;
  role: Role;
  canteenId: string | null;
  name?: string | null;
}

/** Wraps a route handler: maps AppError / ZodError to JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AppError) {
        if (e.status >= 500) console.error(`[api] ${e.code}`, e.detail ?? "");
        return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "BAD_REQUEST", message: "Invalid request.", issues: e.issues.map((i) => i.message) },
          { status: 400 },
        );
      }
      console.error("[api] unexpected", e);
      return NextResponse.json({ error: "INTERNAL", message: "Something went wrong." }, { status: 500 });
    }
  };
}

/** Second line of defence after middleware: every handler re-checks the role. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const session = await auth();
  const u = session?.user;
  if (!u?.userId || !u.role) throw new AppError("UNAUTHENTICATED");
  if (roles && !roles.includes(u.role)) throw new AppError("FORBIDDEN");
  return { userId: u.userId, role: u.role, canteenId: u.canteenId ?? null, name: u.name };
}

/** Staff may only act on their own canteen. */
export async function requireStaff(roles: Role[]): Promise<SessionUser & { canteenId: string }> {
  const u = await requireUser(roles);
  if (!u.canteenId) throw new AppError("FORBIDDEN");
  return u as SessionUser & { canteenId: string };
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", 400, "Body must be JSON.");
  }
  return schema.parse(raw);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Kiosk displays (TV, entrance) carry ?key=KIOSK_KEY. */
export function requireKiosk(req: Request): void {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!safeEqual(key, env.kioskKey())) throw new AppError("FORBIDDEN", 403, "Invalid kiosk key.");
}

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

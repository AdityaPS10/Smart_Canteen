// Role rules shared by middleware, route handlers and pages. Pure (no server imports) so it is testable.

export const ROLES = ["student", "food_server", "cashier"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

export function landingFor(role: Role): string {
  switch (role) {
    case "student":
      return "/canteens";
    case "food_server":
      return "/staff/counter";
    case "cashier":
      return "/staff/cashier";
  }
}

export type Access = "public" | "any" | Role[];

const PUBLIC_PREFIXES = [
  "/login",
  "/staff/login",
  "/api/auth",
  "/tv",
  "/entrance",
  "/api/tv",
  "/api/entrance",
  "/api/payments/webhook",
  "/api/cron/tick",
];

const PAGE_RULES: Array<[string, Role[]]> = [
  ["/canteens", ["student"]],
  ["/menu", ["student"]],
  ["/scan", ["student"]],
  ["/checkout", ["student"]],
  ["/orders", ["student"]],
  ["/pay", ["student"]],
  ["/staff/cashier", ["cashier"]],
  ["/staff/counter", ["food_server"]],
  ["/staff/kitchen", ["food_server"]],
];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/** Who may open a path. API routes other than public ones only need a session here;
 *  each handler checks the exact role again. */
export function accessFor(pathname: string): Access {
  if (PUBLIC_PREFIXES.some((p) => matches(pathname, p))) return "public";
  for (const [prefix, roles] of PAGE_RULES) {
    if (matches(pathname, prefix)) return roles;
  }
  return "any";
}

export function isCollegeEmail(email: string | null | undefined, domain: string | undefined): boolean {
  if (!email || !domain) return false;
  const d = domain.trim().toLowerCase().replace(/^@/, "");
  return d.length > 0 && email.trim().toLowerCase().endsWith("@" + d);
}

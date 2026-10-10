import { SignJWT, errors, jwtVerify } from "jose";
import { AppError } from "./errors";

// Entrance QR tokens: HS256 JWT carrying canteen_id and code_id. Pure (secret passed in) so it is testable.

const AUDIENCE = "canteen-entrance";

function key(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signEntranceToken(
  secret: string,
  p: { canteenId: string; codeId: string; validSeconds: number; now?: number },
): Promise<string> {
  const nowSec = Math.floor((p.now ?? Date.now()) / 1000);
  return new SignJWT({ canteen_id: p.canteenId, code_id: p.codeId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + p.validSeconds)
    .sign(key(secret));
}

export async function verifyEntranceToken(
  secret: string,
  token: string,
  now?: number,
): Promise<{ canteenId: string; codeId: string }> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      audience: AUDIENCE,
      algorithms: ["HS256"],
      currentDate: now ? new Date(now) : undefined,
    });
    const canteenId = payload.canteen_id;
    const codeId = payload.code_id;
    if (typeof canteenId !== "string" || typeof codeId !== "string") throw new AppError("QR_INVALID");
    return { canteenId, codeId };
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof errors.JWTExpired) throw new AppError("QR_EXPIRED");
    throw new AppError("QR_INVALID");
  }
}

/** The QR holds a link (<APP_URL>/scan?t=TOKEN) so a phone camera can open it; the in-app scanner gets the same text. */
export function extractEntranceToken(scanned: string): string {
  const text = scanned.trim();
  try {
    const url = new URL(text);
    const t = url.searchParams.get("t");
    if (t) return t;
  } catch {
    /* not a URL: treat as a raw token */
  }
  return text;
}

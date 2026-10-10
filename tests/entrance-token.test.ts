import { describe, expect, it } from "vitest";
import { extractEntranceToken, signEntranceToken, verifyEntranceToken } from "@/lib/entrance-token";

const SECRET = "test-secret-test-secret-test-secret";
const CANTEEN = "00000000-0000-4000-8000-000000000001";
const CODE = "00000000-0000-4000-8000-00000000abcd";

describe("entrance JWT", () => {
  it("round-trips canteen_id and code_id", async () => {
    const t = await signEntranceToken(SECRET, { canteenId: CANTEEN, codeId: CODE, validSeconds: 65 });
    await expect(verifyEntranceToken(SECRET, t)).resolves.toEqual({ canteenId: CANTEEN, codeId: CODE });
  });

  it("rejects an expired token (60 s + grace)", async () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const t = await signEntranceToken(SECRET, { canteenId: CANTEEN, codeId: CODE, validSeconds: 65, now });
    await expect(verifyEntranceToken(SECRET, t, now + 60_000)).resolves.toBeTruthy();
    await expect(verifyEntranceToken(SECRET, t, now + 66_000)).rejects.toMatchObject({ code: "QR_EXPIRED" });
  });

  it("rejects a forged token", async () => {
    const t = await signEntranceToken("another-secret-another-secret-xx", { canteenId: CANTEEN, codeId: CODE, validSeconds: 65 });
    await expect(verifyEntranceToken(SECRET, t)).rejects.toMatchObject({ code: "QR_INVALID" });
    await expect(verifyEntranceToken(SECRET, "not-a-jwt")).rejects.toMatchObject({ code: "QR_INVALID" });
  });

  it("reads the token from a /scan?t= link or raw text", () => {
    expect(extractEntranceToken("https://canteen.example/scan?t=abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractEntranceToken("  abc.def.ghi ")).toBe("abc.def.ghi");
  });
});

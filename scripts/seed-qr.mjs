// Generates ID-card QR PNGs for the demo users in supabase/seed.sql -> /seed-qr/<role>-<name>.png
// The QR content is the profile's id_card_code (what the ID-card login scanner reads).
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = await readFile(path.join(root, "supabase", "seed.sql"), "utf8");

const block = seed.split("-- BEGIN demo profiles")[1]?.split("-- END demo profiles")[0];
if (!block) throw new Error("Demo profiles block not found in supabase/seed.sql");

// ('id', 'email', 'Full Name', 'role', canteen|null, 'code')
const row = /\(\s*'([^']+)',\s*(?:'[^']*'|null),\s*'([^']+)',\s*'([^']+)',\s*(?:'[^']*'|null),\s*'([^']+)'\s*\)/g;
const outDir = path.join(root, "seed-qr");
await mkdir(outDir, { recursive: true });

let count = 0;
for (const m of block.matchAll(row)) {
  const [, , fullName, role, code] = m;
  const file = path.join(outDir, `${role}-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
  await QRCode.toFile(file, code, { width: 512, margin: 2, errorCorrectionLevel: "M" });
  console.log(`${role.padEnd(12)} ${fullName.padEnd(20)} -> ${path.relative(root, file)}`);
  count++;
}
if (count === 0) throw new Error("No demo profiles parsed.");

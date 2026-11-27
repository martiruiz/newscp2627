// Run once: cd pipeline && node push-keys.mjs  (needs the Supabase CLI logged in)
// Makes the Web Push key pair and stores it straight in Supabase's Edge Function secrets.
// Only the PUBLIC key is printed (it goes in the page); the private key is never shown or written to disk.
import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" }), priv = privateKey.export({ format: "jwk" });
const b = (s) => Buffer.from(s, "base64url");
const publicRaw = Buffer.concat([Buffer.from([4]), b(pub.x), b(pub.y)]).toString("base64url");
const r = spawnSync("npx", ["--yes", "supabase@3.2.0", "secrets", "set", "--project-ref", "wppdbomtiliutpxsimtp",
  `VAPID_PUBLIC_KEY=${publicRaw}`, `VAPID_PRIVATE_KEY=${priv.d}`, "VAPID_SUBJECT=mailto:info@sportscontentplaybook.com"], { stdio: ["ignore", "ignore", "pipe"] });
if (r.status !== 0) { console.error("Could not set the secrets:", String(r.stderr).replace(/[A-Za-z0-9_-]{40,}/g, "***").slice(0, 400)); process.exit(1); }
console.log(`Secrets set. Public key: ${publicRaw}`);

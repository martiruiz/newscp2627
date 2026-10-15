// Test-only stand-in for Supabase: serves the site, a test config.js, PostgREST (/rest/v1), a tiny auth API (/auth/v1)
// and a disk-backed storage API (/storage/v1). Everything on one origin.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SITE = process.argv[2];
const PORT = 8790;
const SECRET = "test-secret-test-secret-test-secret-123456";
const STORE = "/var/tmp/fake-storage";
const PASSWORDS = { "boss@test.com": "Password123", "member@test.com": "Password123" };
fs.mkdirSync(STORE, { recursive: true });

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(payload);
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const verify = (t) => { try { const [h, p, s] = t.split("."); if (crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url") !== s) return null; return JSON.parse(Buffer.from(p, "base64url")); } catch { return null; } };
export const ANON = sign({ role: "anon", iss: "test", exp: 2e9 });

const psql = (sql) => execFileSync("psql", ["-h", "/var/tmp", "-p", "5433", "-U", "postgres", "-d", "scp", "-tAc", sql]).toString().trim();
const userByEmail = (email) => { const r = psql(`select id||'|'||email from auth.users where lower(email)=lower('${email.replace(/'/g, "''")}')`); if (!r) return null; const [id, em] = r.split("|"); return { id, email: em }; };
const session = (u) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const user = { id: u.id, aud: "authenticated", role: "authenticated", email: u.email, created_at: "2026-10-01T10:00:00Z", last_sign_in_at: new Date().toISOString(), app_metadata: {}, user_metadata: {} };
  return { access_token: sign({ sub: u.id, role: "authenticated", email: u.email, aud: "authenticated", exp }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: `r-${u.id}`, user };
};
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))); });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
export const log = [];

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  const auth = (req.headers.authorization || "").replace(/^Bearer /, "");
  const claims = verify(auth);

  if (p === "/js/config.js") {
    res.writeHead(200, { "content-type": "text/javascript" });
    return res.end(`window.SCP_CONFIG = { supabaseUrl: "http://localhost:${PORT}", supabaseAnonKey: "${ANON}", afterLoginPath: "content-library.html" };`);
  }

  if (p.startsWith("/rest/v1/")) {
    const b = await body(req);
    const headers = { ...req.headers, host: "localhost:3000" };
    delete headers.apikey;
    if (!claims) headers.authorization = `Bearer ${ANON}`;
    const up = http.request({ host: "127.0.0.1", port: 3000, method: req.method, path: p.replace("/rest/v1", "") + url.search, headers }, (r) => {
      res.writeHead(r.statusCode, r.headers); r.pipe(res);
    });
    up.on("error", (e) => json(res, 502, { message: e.message }));
    return up.end(b);
  }

  if (p.startsWith("/auth/v1/")) {
    const b = await body(req);
    const data = b.length ? JSON.parse(b.toString()) : {};
    log.push(`${req.method} ${p}${url.search}`);
    if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
      const u = userByEmail(data.email || "");
      if (!u || PASSWORDS[u.email] !== data.password) return json(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" });
      return json(res, 200, session(u));
    }
    if (p === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const id = String(data.refresh_token || "").slice(2);
      const r = psql(`select id||'|'||email from auth.users where id='${id.replace(/'/g, "")}'`);
      if (!r) return json(res, 400, { error: "invalid_grant" });
      const [uid, email] = r.split("|");
      return json(res, 200, session({ id: uid, email }));
    }
    if (p === "/auth/v1/user" && req.method === "GET") {
      if (!claims?.sub) return json(res, 401, { msg: "no session" });
      return json(res, 200, session({ id: claims.sub, email: claims.email }).user);
    }
    if (p === "/auth/v1/user" && req.method === "PUT") {
      if (!claims?.sub) return json(res, 401, { msg: "no session" });
      if (data.password) PASSWORDS[claims.email] = data.password;
      return json(res, 200, session({ id: claims.sub, email: claims.email }).user);
    }
    if (p === "/auth/v1/otp") {
      let u = userByEmail(data.email || "");
      if (!u && data.create_user === false) return json(res, 422, { msg: "Signups not allowed for otp" });
      if (!u) psql(`insert into auth.users (id, email) values (gen_random_uuid(), '${data.email.replace(/'/g, "''")}')`);
      return json(res, 200, {});
    }
    if (p === "/auth/v1/logout") { res.writeHead(204); return res.end(); }
    return json(res, 404, { msg: `not stubbed: ${p}` });
  }

  if (p.startsWith("/storage/v1/object/")) {
    if (!claims?.sub) return json(res, 403, { message: "not signed in" });
    const rel = p.replace("/storage/v1/object/", "").replace(/^(authenticated|public)\//, "");
    const file = path.join(STORE, decodeURIComponent(rel));
    if (req.method === "POST" || req.method === "PUT") {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, await body(req));
      return json(res, 200, { Key: rel, Id: rel });
    }
    if (req.method === "GET") {
      if (!fs.existsSync(file)) return json(res, 404, { message: "Object not found" });
      res.writeHead(200, { "content-type": "text/csv" });
      return res.end(fs.readFileSync(file));
    }
  }

  // static site
  let f = path.join(SITE, decodeURIComponent(p));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(SITE) || !fs.existsSync(f)) { res.writeHead(404); return res.end("not found"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`fake supabase on ${PORT}\nANON=${ANON}`));
fs.writeFileSync("/var/tmp/pgrst/secret", SECRET);

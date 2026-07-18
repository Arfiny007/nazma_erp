/**
 * PHASE_11E.2B — invoke getTerritoryMap only (dashboard path).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TRACE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TRACE_LOGIN_EMAIL ?? "admin@nazma.local";
const PASSWORD = process.env.TRACE_LOGIN_PASSWORD ?? "Admin123!";
const PAGE_PATH = "/dashboard";

const manifest = JSON.parse(
  readFileSync(join(__dirname, "docker-server-reference-manifest.json"), "utf8"),
);

function extractCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const jar = new Map();
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return jar;
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeCookies(jar, response) {
  for (const [k, v] of extractCookies(response)) jar.set(k, v);
}

async function main() {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = await csrfRes.json();
  mergeCookies(jar, csrfRes);

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}${PAGE_PATH}`,
      json: "true",
    }),
    redirect: "manual",
  });
  mergeCookies(jar, loginRes);

  let actionId = null;
  for (const [id, value] of Object.entries(manifest.node ?? {})) {
    const worker = value.workers?.["app/(dashboard)/dashboard/page"];
    if (worker?.exportedName === "getTerritoryMap") actionId = id;
  }
  if (!actionId) throw new Error("getTerritoryMap action id not found");

  const response = await fetch(`${BASE}${PAGE_PATH}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": actionId,
    },
    body: JSON.stringify([]),
  });

  console.log("getTerritoryMap", response.status, (await response.text()).slice(0, 200));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * PHASE_11E.2B — invoke territory-assignment server actions via HTTP (Docker manifest).
 * Run: node scripts/runtime-trace-http-territory.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TRACE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TRACE_LOGIN_EMAIL ?? "admin@nazma.local";
const PASSWORD = process.env.TRACE_LOGIN_PASSWORD ?? "Admin123!";
const PAGE_PATH = "/settings/territory-assignments";

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

function actionId(exportedName) {
  for (const [id, value] of Object.entries(manifest.node ?? {})) {
    const worker = value.workers?.[`app/(dashboard)${PAGE_PATH}/page`];
    if (worker?.exportedName === exportedName) return id;
  }
  return null;
}

async function invokeAction(jar, exportedName, args) {
  const id = actionId(exportedName);
  if (!id) throw new Error(`action not found: ${exportedName}`);

  const response = await fetch(`${BASE}${PAGE_PATH}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": id,
    },
    body: JSON.stringify(args),
  });

  const text = await response.text();
  mergeCookies(jar, response);
  return { status: response.status, text: text.slice(0, 300) };
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
  console.log("login", loginRes.status);

  const pageRes = await fetch(`${BASE}${PAGE_PATH}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  console.log("page GET", pageRes.status);
  mergeCookies(jar, pageRes);

  for (const name of ["searchAssignableUsers", "searchAssignableTerritories"]) {
    const result = await invokeAction(jar, name, { page: 1, pageSize: 50 });
    console.log(name, result.status, result.text);
  }

  const users = await invokeAction(jar, "searchAssignableUsers", {
    page: 1,
    pageSize: 5,
  });
  const userIdMatch = users.text.match(/"id":"([^"]+)"/);
  if (userIdMatch) {
    const list = await invokeAction(jar, "listUserTerritories", {
      userId: userIdMatch[1],
    });
    console.log("listUserTerritories", list.status, list.text.slice(0, 200));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * PHASE_11E.2E — invoke createUser server action via HTTP.
 * Run: node scripts/runtime-trace-http-create-user.mjs [territoryCount]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.TRACE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TRACE_LOGIN_EMAIL ?? "admin@nazma.local";
const PASSWORD = process.env.TRACE_LOGIN_PASSWORD ?? "Admin123!";
const PAGE_PATH = "/settings/users";
const territoryCount = Number(process.argv[2] ?? "3");

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
  return { status: response.status, text, headers: Object.fromEntries(response.headers) };
}

function extractTerritoryIds(html) {
  const matches = [...html.matchAll(/"id":"(cl[a-z0-9]+)"/g)];
  return [...new Set(matches.map((m) => m[1]))].slice(0, territoryCount);
}

function parseActionResult(text) {
  const successMatch = text.match(/"success":(true|false)/);
  const codeMatch = text.match(/"code":"([^"]+)"/);
  const messageKeyMatch = text.match(/"messageKey":"([^"]+)"/);
  const errorNameMatch = text.match(/"name":"([^"]+Error)"/);
  const digestMatch = text.match(/digest":"([^"]+)"/);

  return {
    success: successMatch?.[1] === "true",
    code: codeMatch?.[1] ?? null,
    messageKey: messageKeyMatch?.[1] ?? null,
    errorName: errorNameMatch?.[1] ?? null,
    digest: digestMatch?.[1] ?? null,
    rawPreview: text.slice(0, 800),
  };
}

async function main() {
  const jar = new Map();
  const traceEmail = `http-trace-${Date.now()}@nazma.test`;

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
  console.log("[TRACE] login", loginRes.status);

  const pageRes = await fetch(`${BASE}${PAGE_PATH}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  const pageHtml = await pageRes.text();
  mergeCookies(jar, pageRes);
  console.log("[TRACE] page GET", pageRes.status);

  const territoryIds = extractTerritoryIds(pageHtml);
  console.log("[TRACE] territoryIds", territoryIds);

  const payload = {
    name: `HTTP Trace ${Date.now()}`,
    email: traceEmail,
    role: "SR",
    territoryIds: territoryIds.slice(0, territoryCount),
    phone: null,
    draftOnly: false,
  };

  console.log("[TRACE] createUser payload", JSON.stringify(payload, null, 2));

  const result = await invokeAction(jar, "createUser", payload);
  const parsed = parseActionResult(result.text);

  console.log("[TRACE] createUser HTTP", result.status);
  console.log("[TRACE] createUser parsed", JSON.stringify(parsed, null, 2));
  console.log("[TRACE] createUser full response (first 2000 chars):\n", result.text.slice(0, 2000));
}

main().catch((error) => {
  console.error("[TRACE] UNHANDLED", error);
  process.exitCode = 1;
});

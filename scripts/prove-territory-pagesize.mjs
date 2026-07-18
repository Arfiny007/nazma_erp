/**
 * PHASE_11E.2C — prove client pageSize mismatch vs server validation.
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
  const jar = new Map();
  for (const line of response.headers.getSetCookie?.() ?? []) {
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
  const response = await fetch(`${BASE}${PAGE_PATH}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": id,
    },
    body: JSON.stringify([args]),
  });
  const text = await response.text();
  mergeCookies(jar, response);
  const jsonLine = text.split("\n").find((line) => line.startsWith("1:"));
  const payload = jsonLine ? JSON.parse(jsonLine.slice(2)) : null;
  return { status: response.status, payload, raw: text.slice(0, 400) };
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

  const panelArgs = { page: 1, pageSize: 100 };
  const users = await invokeAction(jar, "searchAssignableUsers", {
    page: 1,
    pageSize: 50,
  });
  const territoriesPanel = await invokeAction(
    jar,
    "searchAssignableTerritories",
    panelArgs,
  );
  const territoriesValid = await invokeAction(jar, "searchAssignableTerritories", {
    page: 1,
    pageSize: 50,
  });

  console.log("=== PANEL EXACT ARGS (users pageSize 50, territories pageSize 100) ===");
  console.log("searchAssignableUsers", {
    httpStatus: users.status,
    success: users.payload?.success,
    itemCount: users.payload?.data?.items?.length,
    error: users.payload?.error,
  });
  console.log("searchAssignableTerritories pageSize:100", {
    httpStatus: territoriesPanel.status,
    success: territoriesPanel.payload?.success,
    error: territoriesPanel.payload?.error,
  });
  console.log("searchAssignableTerritories pageSize:50", {
    httpStatus: territoriesValid.status,
    success: territoriesValid.payload?.success,
    itemCount: territoriesValid.payload?.data?.items?.length,
    total: territoriesValid.payload?.data?.total,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

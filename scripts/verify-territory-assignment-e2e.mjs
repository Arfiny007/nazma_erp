/**
 * PHASE_11E.2D — full territory assignment verification via HTTP server actions.
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

function parsePayload(text) {
  const jsonLine = text.split("\n").find((line) => line.startsWith("1:"));
  return jsonLine ? JSON.parse(jsonLine.slice(2)) : null;
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
    body: JSON.stringify([args]),
  });

  const text = await response.text();
  mergeCookies(jar, response);
  return { status: response.status, payload: parsePayload(text), raw: text };
}

async function login(jar) {
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
  return loginRes.status;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const jar = new Map();
  const results = [];

  const loginStatus = await login(jar);
  results.push(["login", loginStatus === 302 || loginStatus === 200]);

  const pageRes = await fetch(`${BASE}${PAGE_PATH}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  const pageHtml = await pageRes.text();
  mergeCookies(jar, pageRes);
  results.push(["page GET 200", pageRes.status === 200]);
  results.push([
    "page has no loadError string",
    !pageHtml.includes("Unable to load assignment data"),
  ]);

  const users = await invokeAction(jar, "searchAssignableUsers", {
    page: 1,
    pageSize: 50,
  });
  results.push(["searchAssignableUsers success", users.payload?.success === true]);
  results.push([
    "users dropdown data",
    (users.payload?.data?.items?.length ?? 0) > 0,
  ]);

  const territories = await invokeAction(jar, "searchAssignableTerritories", {
    page: 1,
    pageSize: 50,
  });
  results.push([
    "searchAssignableTerritories success",
    territories.payload?.success === true,
  ]);
  results.push([
    "territories dropdown data",
    (territories.payload?.data?.items?.length ?? 0) > 0,
  ]);
  results.push([
    "territories total known",
    territories.payload?.data?.total === 64,
  ]);

  const srUser =
    users.payload?.data?.items?.find((u) => u.role === "SR") ??
    users.payload?.data?.items?.[0];
  const territory = territories.payload?.data?.items?.[0];
  assert(srUser?.id, "no assignable user found");
  assert(territory?.id, "no territory found");

  let assignments = await invokeAction(jar, "listUserTerritories", {
    userId: srUser.id,
  });
  results.push(["listUserTerritories initial success", assignments.payload?.success === true]);

  const assign = await invokeAction(jar, "assignTerritory", {
    userId: srUser.id,
    territoryId: territory.id,
    isPrimary: false,
  });
  results.push(["assignTerritory success", assign.payload?.success === true]);
  const assignmentId = assign.payload?.data?.id;
  results.push(["assignment id returned", Boolean(assignmentId)]);

  assignments = await invokeAction(jar, "listUserTerritories", { userId: srUser.id });
  const activeAfterAssign = (assignments.payload?.data ?? []).filter((a) => a.isActive);
  results.push([
    "assignment visible immediately",
    activeAfterAssign.some((a) => a.territoryId === territory.id),
  ]);

  const pageRefresh = await fetch(`${BASE}${PAGE_PATH}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  results.push(["page refresh 200", pageRefresh.status === 200]);

  assignments = await invokeAction(jar, "listUserTerritories", { userId: srUser.id });
  const activeAfterRefresh = (assignments.payload?.data ?? []).filter((a) => a.isActive);
  results.push([
    "assignment persists after refresh",
    activeAfterRefresh.some((a) => a.territoryId === territory.id),
  ]);

  const revoke = await invokeAction(jar, "revokeTerritoryAssignment", {
    assignmentId,
  });
  results.push(["revokeTerritoryAssignment success", revoke.payload?.success === true]);
  results.push([
    "revoked record inactive",
    revoke.payload?.data?.isActive === false,
  ]);

  assignments = await invokeAction(jar, "listUserTerritories", { userId: srUser.id });
  const activeAfterRevoke = (assignments.payload?.data ?? []).filter(
    (a) => a.isActive && a.territoryId === territory.id,
  );
  results.push(["assignment removed from active list", activeAfterRevoke.length === 0]);

  const pageRefresh2 = await fetch(`${BASE}${PAGE_PATH}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  results.push(["page refresh after revoke 200", pageRefresh2.status === 200]);

  assignments = await invokeAction(jar, "listUserTerritories", { userId: srUser.id });
  const activeFinal = (assignments.payload?.data ?? []).filter(
    (a) => a.isActive && a.territoryId === territory.id,
  );
  results.push([
    "assignment still removed after refresh",
    activeFinal.length === 0,
  ]);

  console.log("=== PHASE_11E.2D VERIFICATION ===");
  let failed = 0;
  for (const [label, ok] of results) {
    console.log(ok ? "PASS" : "FAIL", label);
    if (!ok) failed += 1;
  }
  console.log("---");
  console.log(
    failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

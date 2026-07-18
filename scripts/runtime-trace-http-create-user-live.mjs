/**
 * PHASE_11E.2E — invoke createUser via live Docker action ID.
 * node scripts/runtime-trace-http-create-user-live.mjs [territoryCount]
 */

const BASE = process.env.TRACE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TRACE_LOGIN_EMAIL ?? "admin@nazma.local";
const PASSWORD = process.env.TRACE_LOGIN_PASSWORD ?? "Admin123!";
const PAGE_PATH = "/settings/users";
const ACTION_ID =
  process.env.CREATE_USER_ACTION_ID ??
  "4023a5d5a7d23d0f740a8aad4fa1e5ea790f78bfe2";
const territoryCount = Number(process.argv[2] ?? "3");

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

function extractTerritoryIds(html) {
  const matches = [...html.matchAll(/"id":"([0-9a-f-]{36})"/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

async function invokeCreateUser(jar, payload) {
  const response = await fetch(`${BASE}${PAGE_PATH}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader(jar),
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": ACTION_ID,
    },
    body: JSON.stringify([payload]),
  });
  const text = await response.text();
  mergeCookies(jar, response);
  return { status: response.status, text };
}

async function main() {
  const jar = new Map();
  const traceEmail = `live-trace-${Date.now()}@nazma.test`;

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

  const pageRes = await fetch(`${BASE}${PAGE_PATH}`, { headers: { Cookie: cookieHeader(jar) } });
  const pageHtml = await pageRes.text();
  mergeCookies(jar, pageRes);

  const territoryIds = extractTerritoryIds(pageHtml).slice(0, territoryCount);
  console.log("[TRACE] territoryIds", territoryIds);

  const payload = {
    name: `Live Trace ${Date.now()}`,
    email: traceEmail,
    role: "SR",
    territoryIds,
    phone: null,
    draftOnly: false,
  };

  console.log("[TRACE] invoking createUser", JSON.stringify(payload, null, 2));
  const result = await invokeCreateUser(jar, payload);
  console.log("[TRACE] HTTP status", result.status);
  console.log("[TRACE] response body:\n", result.text.slice(0, 3000));

  const success = result.text.includes('"success":true');
  const messageKey = result.text.match(/"messageKey":"([^"]+)"/)?.[1];
  const code = result.text.match(/"code":"([^"]+)"/)?.[1];
  console.log("[TRACE] parsed", { success, code, messageKey });
}

main().catch((error) => {
  console.error("[TRACE] UNHANDLED", error);
  process.exit(1);
});

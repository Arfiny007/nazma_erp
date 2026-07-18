/**
 * PHASE_11E.2F verification — createUser succeeds when notification infra absent.
 */
const BASE = "http://localhost:3000";
const EMAIL = "admin@nazma.local";
const PASSWORD = "Admin123!";
const PAGE = "/settings/users";
const ACTION_ID =
  process.env.CREATE_USER_ACTION_ID ??
  "4086ecbcbfd3f1d33f1669aa4abf06f8e017009d49";

const TERRITORY_IDS = [
  "027fb491-e4b0-449c-bbb4-26e94bf5ed5d",
  "08f5b061-c7ef-48d1-b29e-6c7aa00d915a",
  "0b66ccb9-41a5-4a5b-9af1-ae65b8c362a9",
  "2b1d0554-f791-4b59-9689-7cd46b1088ee",
  "bf3b81ec-57e6-4488-8d61-c4a3e355638f",
  "0cd23693-4285-4a08-8076-a8148e58c9ad",
  "e4a6224c-05e2-4a28-bd7a-f3012771fdc1",
  "0b66ccb9-41a5-4a5b-9af1-ae65b8c362a9",
  "08f5b061-c7ef-48d1-b29e-6c7aa00d915a",
  "027fb491-e4b0-449c-bbb4-26e94bf5ed5d",
].filter((id, index, all) => all.indexOf(id) === index);

async function login() {
  const jar = new Map();
  const merge = (res) => {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = await csrfRes.json();
  merge(csrfRes);

  await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie() },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}${PAGE}`,
      json: "true",
    }),
    redirect: "manual",
  }).then(merge);

  return cookie();
}

async function createUser(cookie, territoryCount, draftOnly = false) {
  const territoryIds = TERRITORY_IDS.slice(0, territoryCount);
  const email = `verify-11e2f-${territoryCount}t-${Date.now()}@nazma.test`;
  const res = await fetch(`${BASE}${PAGE}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": ACTION_ID,
    },
    body: JSON.stringify([
      {
        name: `Verify ${territoryCount}T`,
        email,
        role: "SR",
        territoryIds,
        phone: null,
        draftOnly,
      },
    ]),
  });
  const text = await res.text();
  return {
    email,
    territoryCount,
    draftOnly,
    success: text.includes('"success":true'),
    hasPassword: text.includes("temporaryPassword"),
    hasActivationToken: text.includes("activationToken"),
    error: text.match(/"messageKey":"([^"]+)"/)?.[1] ?? null,
  };
}

async function main() {
  const cookie = await login();
  const cases = [
    await createUser(cookie, 1, false),
    await createUser(cookie, 2, false),
    await createUser(cookie, 10, false),
    await createUser(cookie, 2, true),
  ];

  console.log(JSON.stringify(cases, null, 2));
  const failed = cases.filter((c) => !c.success);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

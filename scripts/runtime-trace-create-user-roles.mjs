const BASE = "http://localhost:3000";
const ACTION_ID = "4023a5d5a7d23d0f740a8aad4fa1e5ea790f78bfe2";
const PAGE = "/settings/users";

async function login(email, password) {
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
      email,
      password,
      callbackUrl: `${BASE}${PAGE}`,
      json: "true",
    }),
    redirect: "manual",
  }).then(merge);

  return { jar, cookie: cookie() };
}

async function createUser(cookie, payload) {
  const res = await fetch(`${BASE}${PAGE}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Accept: "text/x-component",
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": ACTION_ID,
    },
    body: JSON.stringify([payload]),
  });
  return res.text();
}

async function main() {
  const territoryIds = [
    "027fb491-e4b0-449c-bbb4-26e94bf5ed5d",
    "08f5b061-c7ef-48d1-b29e-6c7aa00d915a",
    "0b66ccb9-41a5-4a5b-9af1-ae65b8c362a9",
  ];

  // Super Admin — draftOnly false (default)
  const admin = await login("admin@nazma.local", "Admin123!");
  const adminText = await createUser(admin.cookie, {
    name: `Admin SA ${Date.now()}`,
    email: `admin-sa-${Date.now()}@nazma.test`,
    role: "SR",
    territoryIds: territoryIds.slice(0, 3),
    phone: null,
    draftOnly: false,
  });
  console.log("Super_Admin draftOnly=false territories=3", {
    success: adminText.includes('"success":true'),
    error: adminText.match(/"messageKey":"([^"]+)"/)?.[1],
  });

  // Super Admin — draftOnly true (manual)
  const adminDraft = await createUser(admin.cookie, {
    name: `Admin Draft ${Date.now()}`,
    email: `admin-draft-${Date.now()}@nazma.test`,
    role: "SR",
    territoryIds: territoryIds.slice(0, 3),
    phone: null,
    draftOnly: true,
  });
  console.log("Super_Admin draftOnly=true territories=3", {
    success: adminDraft.includes('"success":true'),
    error: adminDraft.match(/"messageKey":"([^"]+)"/)?.[1],
  });

  // Manager — draftOnly true (UI default)
  const mgr = await login("manager1@nazma.test", "Demo123!");
  const mgrText = await createUser(mgr.cookie, {
    name: `Mgr Draft ${Date.now()}`,
    email: `mgr-draft-${Date.now()}@nazma.test`,
    role: "SR",
    territoryIds: territoryIds.slice(0, 2),
    phone: null,
    draftOnly: true,
  });
  console.log("Manager draftOnly=true territories=2", {
    success: mgrText.includes('"success":true'),
    error: mgrText.match(/"messageKey":"([^"]+)"/)?.[1],
  });
}

main().catch(console.error);

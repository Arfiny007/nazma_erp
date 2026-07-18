const BASE = process.env.TRACE_BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TRACE_LOGIN_EMAIL ?? "admin@nazma.local";
const PASSWORD = process.env.TRACE_LOGIN_PASSWORD ?? "Admin123!";

async function main() {
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
      callbackUrl: `${BASE}/settings/users`,
      json: "true",
    }),
    redirect: "manual",
  }).then(merge);

  const pageRes = await fetch(`${BASE}/settings/users`, {
    headers: {
      Cookie: cookie(),
      RSC: "1",
      "Next-Router-State-Tree": encodeURIComponent(
        JSON.stringify(["", { children: ["(dashboard)", { children: ["settings", { children: ["users", { children: ["__PAGE__", {}] }] }] }] }, null, null, true]),
      ),
    },
  });
  const text = await pageRes.text();
  console.log("status", pageRes.status, "len", text.length);

  const createUserHits = [];
  let idx = 0;
  while ((idx = text.indexOf("createUser", idx)) !== -1) {
    createUserHits.push(text.slice(Math.max(0, idx - 80), idx + 80));
    idx += 1;
  }
  console.log("createUser hits", createUserHits.length);
  for (const hit of createUserHits.slice(0, 3)) {
    console.log("---\n", hit);
  }

  const hashes = [...text.matchAll(/[a-f0-9]{40,64}/g)].map((m) => m[0]);
  const unique = [...new Set(hashes)];
  console.log("hash count", unique.length);
  console.log("sample hashes", unique.slice(0, 5));
}

main().catch(console.error);

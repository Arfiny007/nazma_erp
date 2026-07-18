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

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie(),
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE}/settings/users`,
      json: "true",
    }),
    redirect: "manual",
  });
  merge(loginRes);

  const pageRes = await fetch(`${BASE}/settings/users`, {
    headers: { Cookie: cookie() },
  });
  const text = await pageRes.text();

  const createUserIdx = text.indexOf("createUser");
  console.log("createUser context:", text.slice(Math.max(0, createUserIdx - 120), createUserIdx + 120));

  const actionIds = [...text.matchAll(/"([a-f0-9]{48,64})"/g)].map((m) => m[1]);
  console.log("hash-like strings count:", actionIds.length);

  const territoryIdx = text.indexOf("territoryOptions");
  if (territoryIdx >= 0) {
    console.log("territoryOptions context:", text.slice(territoryIdx, territoryIdx + 500));
  }

  const labels = [...text.matchAll(/"label":"([^"]+)"/g)].slice(0, 10).map((m) => m[1]);
  console.log("labels sample:", labels);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

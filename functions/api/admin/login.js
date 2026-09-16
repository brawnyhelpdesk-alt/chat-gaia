import { cookie, createSession, json, originAllowed, verifyPassword } from "../_admin.js";

async function rateLimit(request, env) {
  const source = request.headers.get("CF-Connecting-IP") || "unknown";
  const data = new TextEncoder().encode(source);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const key = `admin-login:${Array.from(digest.slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const attempts = Number(await env.GAIA_OPTIONS.get(key)) || 0;
  if (attempts >= 5) return { blocked: true, key };
  await env.GAIA_OPTIONS.put(key, String(attempts + 1), { expirationTtl: 300 });
  return { blocked: false, key };
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request) || !env.GAIA_OPTIONS || !env.GAIA_ADMIN_SIGNING_KEY) return json({ error: "unavailable" }, 503);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 512) return json({ error: "invalid_request" }, 400);
  const limiter = await rateLimit(request, env);
  if (limiter.blocked) return json({ error: "rate_limited" }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!await verifyPassword(body?.password, env)) return json({ error: "invalid_credentials" }, 401);
  await env.GAIA_OPTIONS.delete(limiter.key);
  return json({ ok: true }, 200, { "Set-Cookie": cookie(await createSession(env)) });
}

export async function onRequest({ request, env }) {
  if (request.method === "POST") return onRequestPost({ request, env });
  return json({ error: "method_not_allowed" }, 405);
}

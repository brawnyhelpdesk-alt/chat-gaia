import { existingZendeskUser } from "./_zendesk.js";
const encoder = new TextEncoder();
const ORIGINS = new Set(["https://gaia-ascendis.pages.dev", "https://gaia.corripio.com.do"]);
const PIN_PATTERN = /^[0-9]{4}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
}

function normalizeCedula(value) {
  if (typeof value !== "string" || !/^[0-9\s\-\u2010-\u2015]*$/u.test(value)) return null;
  const digits = value.replace(/[\s\-\u2010-\u2015]/gu, "");
  return /^[0-9]{11}$/.test(digits) ? digits : null;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try { return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), (char) => char.charCodeAt(0)); } catch { return null; }
}

async function digest(value) { return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }
async function recordKey(prefix, value) { return `${prefix}:${base64Url((await digest(value)).slice(0, 18))}`; }

async function hashPin(pin, salt, secret) {
  if (typeof secret !== "string" || secret.length < 16) throw new Error("pin_secret_unavailable");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${base64Url(salt)}:${pin}`)));
}

function sameBytes(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function limited(request, env, cedula) {
  const source = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = await recordKey("gaia-pin-attempt", `${source}:${cedula}`);
  const data = await env.GAIA_OPTIONS.get(key, "json");
  if (data?.lockedUntil && data.lockedUntil > Date.now()) return { locked: true, key, data };
  return { locked: false, key, data: data || { attempts: 0 } };
}

async function failedAttempt(limiter, env) {
  const attempts = Math.min((Number(limiter.data?.attempts) || 0) + 1, 5);
  const lockedUntil = attempts >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
  await env.GAIA_OPTIONS.put(limiter.key, JSON.stringify({ attempts, lockedUntil }), { expirationTtl: 15 * 60 });
  return lockedUntil > 0;
}

export async function verifyPin(request, env, cedula, pin) {
  if (!env.GAIA_OPTIONS || !PIN_PATTERN.test(pin || "")) return { ok: false, status: 400, error: "invalid_request" };
  const limiter = await limited(request, env, cedula);
  if (limiter.locked) return { ok: false, status: 429, error: "locked" };
  const key = await recordKey("gaia-pin", cedula);
  const saved = await env.GAIA_OPTIONS.get(key, "json");
  const salt = fromBase64Url(saved?.salt), expected = fromBase64Url(saved?.hash);
  if (!salt || !expected || saved?.v !== 1) return { ok: false, status: 401, error: "pin_not_set" };
  const actual = await hashPin(pin, salt, env.GAIA_ADMIN_SIGNING_KEY);
  if (!sameBytes(actual, expected)) return { ok: false, status: await failedAttempt(limiter, env) ? 429 : 401, error: "invalid_pin" };
  await env.GAIA_OPTIONS.delete(limiter.key);
  return { ok: true };
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (origin && !ORIGINS.has(origin)) return json({ error: "forbidden" }, 403);
  if (!env.GAIA_OPTIONS || !request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 512) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const cedula = normalizeCedula(body?.cedula);
  if (!cedula) return json({ error: "invalid_request" }, 400);
  const key = await recordKey("gaia-pin", cedula);
  if (body?.action === "status") {
    const user = await existingZendeskUser(env, cedula);
    if (!user.ok) return json({ error: user.error }, user.error === "user_not_found" ? 404 : 503);
    return json({ enrolled: Boolean(await env.GAIA_OPTIONS.get(key)) });
  }
  if (body?.action !== "enroll" || !PIN_PATTERN.test(body?.pin || "")) return json({ error: "invalid_request" }, 400);
  const user = await existingZendeskUser(env, cedula);
  if (!user.ok) return json({ error: user.error }, user.error === "user_not_found" ? 404 : 503);
  if (await env.GAIA_OPTIONS.get(key)) return json({ error: "already_enrolled" }, 409);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  let hash;
  try { hash = await hashPin(body.pin, salt, env.GAIA_ADMIN_SIGNING_KEY); } catch { return json({ error: "service_unavailable" }, 503); }
  await env.GAIA_OPTIONS.put(key, JSON.stringify({ v: 1, salt: base64Url(salt), hash: base64Url(hash), createdAt: new Date().toISOString() }));
  return json({ enrolled: true }, 201);
}

export async function onRequest(context) { return context.request.method === "POST" ? onRequestPost(context) : json({ error: "method_not_allowed" }, 405); }

const encoder = new TextEncoder();
const ORIGIN = "https://gaia-ascendis.pages.dev";

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      ...extraHeaders
    }
  });
}

export function originAllowed(request) {
  const origin = request.headers.get("Origin");
  // Same-origin navigations can omit Origin when the page uses no-referrer.
  // Cross-site requests cannot carry the Strict administrator-session cookie.
  return !origin || origin === ORIGIN;
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), (letter) => letter.charCodeAt(0));
  } catch { return null; }
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function sameSecret(value, expected) {
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index % a.length] || 0) ^ (b[index % b.length] || 0);
  return difference === 0;
}

export async function createSession(env) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload = base64Url(encoder.encode(JSON.stringify({ v: 1, exp: now + 60 * 60 * 8, nonce })));
  const signature = base64Url(await hmac(payload, env.GAIA_ADMIN_SIGNING_KEY));
  return `${payload}.${signature}`;
}

export async function authenticated(request, env) {
  if (!env.GAIA_ADMIN_SIGNING_KEY) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)gaia_admin=([^;]+)/);
  if (!match) return false;
  const [payload, signature] = match[1].split(".");
  if (!payload || !signature) return false;
  const signatureBytes = decodeBase64Url(signature);
  if (!signatureBytes) return false;
  const expected = await hmac(payload, env.GAIA_ADMIN_SIGNING_KEY);
  if (expected.length !== signatureBytes.length || !crypto.subtle.timingSafeEqual?.(expected, signatureBytes)) {
    let difference = expected.length ^ signatureBytes.length;
    for (let index = 0; index < Math.max(expected.length, signatureBytes.length); index += 1) difference |= (expected[index % expected.length] || 0) ^ (signatureBytes[index % signatureBytes.length] || 0);
    if (difference !== 0) return false;
  }
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return data?.v === 1 && Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function verifyPassword(value, env) {
  return typeof value === "string" && value.length >= 16 && value.length <= 200 && typeof env.GAIA_ADMIN_PASSWORD === "string" && env.GAIA_ADMIN_PASSWORD.length >= 16 && sameSecret(value, env.GAIA_ADMIN_PASSWORD);
}

export function cookie(value) {
  return `gaia_admin=${value}; Path=/api/admin/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
}

export function clearCookie() {
  return "gaia_admin=; Path=/api/admin/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

const baseOptionKeys = new Set(["password", "access", "failure", "configuration", "equipment", "system", "consultation"]);

export function validOptions(value) {
  if (!Array.isArray(value) || value.length > 10) return null;
  const ids = new Set();
  const cleaned = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-z0-9-]{2,40}$/i.test(item.id)) return null;
    const id = item.id.toLowerCase();
    if (ids.has(id)) return null;
    ids.add(id);
    const fields = ["title", "description", "question"];
    if (!fields.every((field) => typeof item[field] === "string" && item[field].trim())) return null;
    if (item.title.length > 70 || item.description.length > 120 || item.question.length > 140 || !Array.isArray(item.choices) || item.choices.length < 1 || item.choices.length > 12) return null;
    const choices = item.choices.map((choice) => typeof choice === "string" ? choice.trim() : "").filter(Boolean);
    if (choices.length !== item.choices.length || choices.some((choice) => choice.length > 100)) return null;
    const icon = typeof item.icon === "string" && /^[a-z0-9-]{2,40}$/i.test(item.icon) ? item.icon.toLowerCase() : "sparkles";
    cleaned.push({ id, title: item.title.trim(), description: item.description.trim(), question: item.question.trim(), choices, icon });
  }
  return cleaned;
}

export function validIcons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > baseOptionKeys.size) return null;
  const cleaned = {};
  for (const [key, icon] of Object.entries(value)) {
    if (!baseOptionKeys.has(key) || typeof icon !== "string" || !/^[a-z0-9-]{2,40}$/i.test(icon)) return null;
    cleaned[key] = icon.toLowerCase();
  }
  return cleaned;
}

export function validKioskSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const width = Number(value.width), height = Number(value.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 640 || width > 3840 || height < 480 || height > 2160) return null;
  return { width, height };
}

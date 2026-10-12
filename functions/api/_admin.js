const encoder = new TextEncoder();
const ORIGINS = new Set(["https://gaia-ascendis.pages.dev", "https://gaia.corripio.com.do"]);

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
  return !origin || ORIGINS.has(origin);
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

async function passwordHash(value, salt, secret) {
  return hmac(`gaia-admin-password:${salt}:${value}`, secret);
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
  const payload = base64Url(encoder.encode(JSON.stringify({ v: 1, exp: now + 60 * 60 * 2, nonce })));
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
  if (typeof value !== "string" || value.length < 16 || value.length > 200 || !env.GAIA_OPTIONS || !env.GAIA_ADMIN_SIGNING_KEY) return false;
  const saved = await env.GAIA_OPTIONS.get("gaia-admin-password", "json");
  if (saved?.v === 1 && typeof saved.salt === "string" && typeof saved.hash === "string") {
    const actual = base64Url(await passwordHash(value, saved.salt, env.GAIA_ADMIN_SIGNING_KEY));
    return sameSecret(actual, saved.hash);
  }
  return typeof env.GAIA_ADMIN_PASSWORD === "string" && env.GAIA_ADMIN_PASSWORD.length >= 16 && sameSecret(value, env.GAIA_ADMIN_PASSWORD);
}

export function secureAdminPassword(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 200 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export async function setAdminPassword(env, value) {
  if (!env.GAIA_OPTIONS || !env.GAIA_ADMIN_SIGNING_KEY || !secureAdminPassword(value)) return false;
  const salt = base64Url(crypto.getRandomValues(new Uint8Array(18)));
  const hash = base64Url(await passwordHash(value, salt, env.GAIA_ADMIN_SIGNING_KEY));
  await env.GAIA_OPTIONS.put("gaia-admin-password", JSON.stringify({ v: 1, salt, hash, updatedAt: new Date().toISOString() }));
  return true;
}

export function cookie(value) {
  return `gaia_admin=${value}; Path=/api/admin/; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`;
}

export function clearCookie() {
  return "gaia_admin=; Path=/api/admin/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";
}

const baseOptionKeys = new Set(["password", "access", "failure", "configuration", "equipment", "system", "consultation"]);
const builtInIconPattern = /^[a-z0-9-]{2,40}$/i;
const uploadedIconPattern = /^png:[a-z0-9_-]{12,64}$/i;

export function validIconReference(value) {
  return typeof value === "string" && (builtInIconPattern.test(value) || uploadedIconPattern.test(value));
}

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
    const icon = validIconReference(item.icon) ? item.icon.toLowerCase() : "sparkles";
    cleaned.push({ id, title: item.title.trim(), description: item.description.trim(), question: item.question.trim(), choices, icon });
  }
  return cleaned;
}

export function validIcons(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > baseOptionKeys.size) return null;
  const cleaned = {};
  for (const [key, icon] of Object.entries(value)) {
    if (!baseOptionKeys.has(key) || !validIconReference(icon)) return null;
    cleaned[key] = icon.toLowerCase();
  }
  return cleaned;
}

export function validOrder(value, options) {
  const custom = new Set((options || []).map((item) => `custom:${item.id}`));
  const allowed = new Set([...baseOptionKeys, ...custom]);
  const fallback = [...baseOptionKeys, ...custom];
  if (!Array.isArray(value)) return fallback;
  const result = [];
  for (const key of value) {
    if (typeof key !== "string" || !allowed.has(key) || result.includes(key)) return null;
    result.push(key);
  }
  for (const key of fallback) if (!result.includes(key)) result.push(key);
  return result;
}

export function validHidden(value, options) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set([...baseOptionKeys, ...(options || []).map((item) => `custom:${item.id}`)]);
  if (value.length > allowed.size || value.some((key) => typeof key !== "string" || !allowed.has(key))) return null;
  return [...new Set(value)];
}

function base32(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(text) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const output = [];
  for (const letter of String(text).replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(letter);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(output);
}

async function encryptionKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`gaia-admin-mfa:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env.GAIA_ADMIN_SIGNING_KEY), encoder.encode(value));
  return { iv: base64Url(iv), value: base64Url(new Uint8Array(encrypted)) };
}

async function unseal(record, env) {
  try {
    const iv = decodeBase64Url(record?.iv || ""), value = decodeBase64Url(record?.value || "");
    if (!iv || !value) return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await encryptionKey(env.GAIA_ADMIN_SIGNING_KEY), value);
    return new TextDecoder().decode(plain);
  } catch { return null; }
}

async function totp(secret, counter) {
  const bytes = fromBase32(secret);
  if (!bytes) return null;
  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = new Uint8Array(8);
  let value = BigInt(counter);
  for (let index = 7; index >= 0; index -= 1) { message[index] = Number(value & 255n); value >>= 8n; }
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = signature[signature.length - 1] & 15;
  const number = ((signature[offset] & 127) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3];
  return String(number % 1000000).padStart(6, "0");
}

async function verifyTotp(secret, code) {
  if (!/^[0-9]{6}$/.test(String(code || ""))) return false;
  const current = Math.floor(Date.now() / 30000);
  for (let drift = -1; drift <= 1; drift += 1) if (await totp(secret, current + drift) === code) return true;
  return false;
}

async function recoveryHash(code, env) {
  return base64Url(await hmac(`gaia-admin-recovery:${String(code).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`, env.GAIA_ADMIN_SIGNING_KEY));
}

function newRecoveryCodes() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export async function mfaStatus(env) {
  const saved = env.GAIA_OPTIONS ? await env.GAIA_OPTIONS.get("gaia-admin-mfa", "json") : null;
  return { enabled: saved?.v === 1 && !!saved.secret };
}

function authenticatorUri(secret) {
  return `otpauth://totp/GAIA%20Administrador?secret=${secret}&issuer=GAIA&algorithm=SHA1&digits=6&period=30`;
}

export async function beginMfa(env) {
  const secret = base32(crypto.getRandomValues(new Uint8Array(20)));
  const enrollmentToken = await seal(JSON.stringify({ v: 1, secret, exp: Math.floor(Date.now() / 1000) + 900 }), env);
  return { secret, enrollmentToken, uri: authenticatorUri(secret) };
}

export async function enableMfa(env, code, enrollmentToken) {
  let enrollment;
  try { enrollment = JSON.parse(await unseal(enrollmentToken, env)); } catch { return null; }
  if (enrollment?.v !== 1 || typeof enrollment.secret !== "string" || !Number.isInteger(enrollment.exp) || enrollment.exp < Math.floor(Date.now() / 1000) || !await verifyTotp(enrollment.secret, code)) return null;
  const codes = newRecoveryCodes();
  const hashes = await Promise.all(codes.map((item) => recoveryHash(item, env)));
  await env.GAIA_OPTIONS.put("gaia-admin-mfa", JSON.stringify({ v: 1, secret: await seal(enrollment.secret, env), recovery: hashes, enabledAt: new Date().toISOString() }));
  return codes;
}

export async function verifyMfa(env, code) {
  const saved = await env.GAIA_OPTIONS.get("gaia-admin-mfa", "json");
  if (saved?.v !== 1) return true;
  const secret = await unseal(saved.secret, env);
  if (secret && await verifyTotp(secret, String(code || ""))) return true;
  const normalized = String(code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (normalized.length !== 8 || !Array.isArray(saved.recovery)) return false;
  const hash = await recoveryHash(normalized, env);
  const index = saved.recovery.indexOf(hash);
  if (index < 0) return false;
  saved.recovery.splice(index, 1);
  saved.usedRecoveryAt = new Date().toISOString();
  await env.GAIA_OPTIONS.put("gaia-admin-mfa", JSON.stringify(saved));
  return true;
}

export async function verifyCurrentTotp(env, code) {
  const saved = await env.GAIA_OPTIONS.get("gaia-admin-mfa", "json");
  if (saved?.v !== 1 || !saved.secret) return false;
  const secret = await unseal(saved.secret, env);
  return !!secret && await verifyTotp(secret, String(code || ""));
}

export async function currentMfaEnrollment(env) {
  const saved = await env.GAIA_OPTIONS.get("gaia-admin-mfa", "json");
  if (saved?.v !== 1 || !saved.secret) return null;
  const secret = await unseal(saved.secret, env);
  return secret ? { secret, uri: authenticatorUri(secret) } : null;
}

export async function disableMfa(env) {
  await env.GAIA_OPTIONS.delete("gaia-admin-mfa");
  await env.GAIA_OPTIONS.delete("gaia-admin-mfa-pending");
}

export async function regenerateRecoveryCodes(env) {
  const saved = await env.GAIA_OPTIONS.get("gaia-admin-mfa", "json");
  if (saved?.v !== 1) return null;
  const codes = newRecoveryCodes();
  saved.recovery = await Promise.all(codes.map((item) => recoveryHash(item, env)));
  saved.recoveryUpdatedAt = new Date().toISOString();
  await env.GAIA_OPTIONS.put("gaia-admin-mfa", JSON.stringify(saved));
  return codes;
}

export function validKioskSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const width = Number(value.width), height = Number(value.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 640 || width > 3840 || height < 480 || height > 2160) return null;
  return { width, height };
}

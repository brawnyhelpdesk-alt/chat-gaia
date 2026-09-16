const encoder = new TextEncoder();
const ORIGINS = new Set(["https://gaia-ascendis.pages.dev", "https://gaia.corripio.com.do"]);

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try { return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4)), (letter) => letter.charCodeAt(0)); } catch { return null; }
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function equal(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function zendeskBase(env) {
  const subdomain = typeof env.ZENDESK_SUPPORT_SUBDOMAIN === "string" ? env.ZENDESK_SUPPORT_SUBDOMAIN.trim().toLowerCase() : "";
  return /^[a-z0-9-]{2,63}$/.test(subdomain) ? `https://${subdomain}.zendesk.com` : null;
}

export function oauthConfigured(env) {
  return Boolean(zendeskBase(env) && env.GAIA_OPTIONS && typeof env.GAIA_ADMIN_SIGNING_KEY === "string" && env.GAIA_ADMIN_SIGNING_KEY && typeof env.ZENDESK_OAUTH_CLIENT_ID === "string" && env.ZENDESK_OAUTH_CLIENT_ID && typeof env.ZENDESK_OAUTH_CLIENT_SECRET === "string" && env.ZENDESK_OAUTH_CLIENT_SECRET);
}

export async function createState(origin, env) {
  const payload = base64Url(encoder.encode(JSON.stringify({ v: 1, origin, exp: Math.floor(Date.now() / 1000) + 600, nonce: base64Url(crypto.getRandomValues(new Uint8Array(18))) })));
  return `${payload}.${base64Url(await hmac(payload, env.GAIA_ADMIN_SIGNING_KEY))}`;
}

export async function readState(value, env) {
  const [payload, signature] = typeof value === "string" ? value.split(".") : [];
  const actual = decodeBase64Url(signature);
  if (!payload || !actual || !equal(await hmac(payload, env.GAIA_ADMIN_SIGNING_KEY), actual)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return data?.v === 1 && ORIGINS.has(data.origin) && Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000) ? data : null;
  } catch { return null; }
}

export function html(text, status = 200) {
  return new Response(`<!doctype html><meta charset="utf-8"><title>GAIA</title><main><h1>GAIA</h1><p>${text}</p></main>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

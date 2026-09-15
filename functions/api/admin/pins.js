import { authenticated, json, originAllowed } from "../_admin.js";

const encoder = new TextEncoder();

function normalizeCedula(value) {
  if (typeof value !== "string" || !/^[0-9\s\-\u2010-\u2015]*$/u.test(value)) return null;
  const digits = value.replace(/[\s\-\u2010-\u2015]/gu, "");
  return /^[0-9]{11}$/.test(digits) ? digits : null;
}

function base64Url(bytes) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function pinKey(cedula) { return `gaia-pin:${base64Url((new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(cedula)))).slice(0, 18))}`; }

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request) || !env.GAIA_OPTIONS || !await authenticated(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 256) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const cedula = normalizeCedula(body?.cedula);
  if (!cedula) return json({ error: "invalid_request" }, 400);
  await env.GAIA_OPTIONS.delete(await pinKey(cedula));
  return json({ reset: true });
}

export async function onRequest(context) { return context.request.method === "POST" ? onRequestPost(context) : json({ error: "method_not_allowed" }, 405); }

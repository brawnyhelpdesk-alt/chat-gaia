import { authenticated, json, originAllowed, validKioskSettings } from "../_admin.js";

const DEFAULTS = { width: 1024, height: 768 };

export async function onRequestGet({ request, env }) {
  if (!originAllowed(request) || !env.GAIA_OPTIONS) return json({ error: "unavailable" }, 503);
  const saved = await env.GAIA_OPTIONS.get("technology-kiosk", "json");
  return json({ settings: validKioskSettings(saved) || DEFAULTS });
}

export async function onRequestPut({ request, env }) {
  if (!originAllowed(request) || !env.GAIA_OPTIONS || !await authenticated(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 300) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const settings = validKioskSettings(body?.settings);
  if (!settings) return json({ error: "invalid_settings" }, 400);
  await env.GAIA_OPTIONS.put("technology-kiosk", JSON.stringify(settings));
  return json({ settings });
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") return onRequestGet({ request, env });
  if (request.method === "PUT") return onRequestPut({ request, env });
  return json({ error: "method_not_allowed" }, 405);
}

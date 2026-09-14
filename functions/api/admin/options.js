import { authenticated, json, originAllowed, validIcons, validOptions } from "../_admin.js";

async function permitted(request, env) {
  return originAllowed(request) && env.GAIA_OPTIONS && await authenticated(request, env);
}

export async function onRequestGet({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  const saved = await env.GAIA_OPTIONS.get("custom-options", "json");
  return json({ options: Array.isArray(saved?.options) ? saved.options : [], icons: saved?.icons && typeof saved.icons === "object" ? saved.icons : {} });
}

export async function onRequestPut({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 12000) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const options = validOptions(body?.options);
  const icons = validIcons(body?.icons);
  if (!options || !icons) return json({ error: "invalid_options" }, 400);
  await env.GAIA_OPTIONS.put("custom-options", JSON.stringify({ options, icons, updatedAt: new Date().toISOString() }));
  return json({ options, icons });
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") return onRequestGet({ request, env });
  if (request.method === "PUT") return onRequestPut({ request, env });
  return json({ error: "method_not_allowed" }, 405);
}

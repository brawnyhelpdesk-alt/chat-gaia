import { authenticated, json, originAllowed, validHidden, validIcons, validOptions, validOrder } from "../_admin.js";

async function permitted(request, env) {
  return originAllowed(request) && env.GAIA_OPTIONS && await authenticated(request, env);
}

export async function onRequestGet({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  const saved = await env.GAIA_OPTIONS.get("custom-options", "json");
  const options = Array.isArray(saved?.options) ? saved.options : [];
  return json({ options, icons: saved?.icons && typeof saved.icons === "object" ? saved.icons : {}, order: validOrder(saved?.order, options), hidden: validHidden(saved?.hidden, options) || [], revision: Number(saved?.revision) || 0, updatedAt: saved?.updatedAt || null, canRestore: !!await env.GAIA_OPTIONS.get("custom-options-backup") });
}

export async function onRequestPut({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 30000) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  const options = validOptions(body?.options);
  const icons = validIcons(body?.icons);
  const order = options && validOrder(body?.order, options);
  const hidden = options && validHidden(body?.hidden, options);
  if (!options || !icons || !order || !hidden) return json({ error: "invalid_options" }, 400);
  const previous = await env.GAIA_OPTIONS.get("custom-options", "json");
  if (previous) await env.GAIA_OPTIONS.put("custom-options-backup", JSON.stringify(previous));
  const saved = { options, icons, order, hidden, revision: (Number(previous?.revision) || 0) + 1, updatedAt: new Date().toISOString() };
  await env.GAIA_OPTIONS.put("custom-options", JSON.stringify(saved));
  return json({ ...saved, canRestore: !!previous });
}

export async function onRequestPost({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (body?.action !== "restore") return json({ error: "invalid_request" }, 400);
  const backup = await env.GAIA_OPTIONS.get("custom-options-backup", "json");
  if (!backup) return json({ error: "no_backup" }, 404);
  const current = await env.GAIA_OPTIONS.get("custom-options", "json");
  const restored = { ...backup, revision: (Number(current?.revision) || 0) + 1, updatedAt: new Date().toISOString() };
  await env.GAIA_OPTIONS.put("custom-options", JSON.stringify(restored));
  await env.GAIA_OPTIONS.put("custom-options-backup", JSON.stringify(current || {}));
  return json({ ...restored, canRestore: true });
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") return onRequestGet({ request, env });
  if (request.method === "PUT") return onRequestPut({ request, env });
  if (request.method === "POST") return onRequestPost({ request, env });
  return json({ error: "method_not_allowed" }, 405);
}

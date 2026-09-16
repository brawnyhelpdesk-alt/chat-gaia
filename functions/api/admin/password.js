import { authenticated, json, originAllowed, secureAdminPassword, setAdminPassword, verifyPassword } from "../_admin.js";

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request) || !env.GAIA_OPTIONS || !await authenticated(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 1024) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (!await verifyPassword(body?.currentPassword, env)) return json({ error: "invalid_credentials" }, 401);
  if (body?.newPassword !== body?.confirmation || !secureAdminPassword(body?.newPassword)) return json({ error: "weak_password" }, 400);
  if (!await setAdminPassword(env, body.newPassword)) return json({ error: "unavailable" }, 503);
  return json({ changed: true });
}

export async function onRequest(context) { return context.request.method === "POST" ? onRequestPost(context) : json({ error: "method_not_allowed" }, 405); }

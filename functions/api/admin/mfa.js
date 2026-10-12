import { authenticated, beginMfa, disableMfa, enableMfa, json, mfaStatus, originAllowed, regenerateRecoveryCodes, verifyMfa, verifyPassword } from "../_admin.js";

async function permitted(request, env) {
  return originAllowed(request) && env.GAIA_OPTIONS && env.GAIA_ADMIN_SIGNING_KEY && await authenticated(request, env);
}

export async function onRequestGet({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  return json(await mfaStatus(env));
}

export async function onRequestPost({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") || Number(request.headers.get("Content-Length") || "0") > 1024) return json({ error: "invalid_request" }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid_request" }, 400); }
  if (body?.action === "begin") return json(await beginMfa(env));
  if (body?.action === "enable") {
    const recoveryCodes = await enableMfa(env, body.code, body.enrollmentToken);
    return recoveryCodes ? json({ enabled: true, recoveryCodes }) : json({ error: "invalid_mfa" }, 400);
  }
  if (body?.action === "disable") {
    if (!await verifyPassword(body.currentPassword, env) || !await verifyMfa(env, body.code)) return json({ error: "invalid_credentials" }, 401);
    await disableMfa(env);
    return json({ enabled: false });
  }
  if (body?.action === "recovery") {
    if (!await verifyPassword(body.currentPassword, env) || !await verifyMfa(env, body.code)) return json({ error: "invalid_credentials" }, 401);
    const recoveryCodes = await regenerateRecoveryCodes(env);
    return recoveryCodes ? json({ recoveryCodes }) : json({ error: "mfa_not_enabled" }, 400);
  }
  return json({ error: "invalid_request" }, 400);
}

export async function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "method_not_allowed" }, 405);
}

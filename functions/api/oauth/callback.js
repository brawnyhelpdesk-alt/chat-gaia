import { html, oauthConfigured, readState, zendeskBase } from "../_oauth.js";

export async function onRequestGet({ request, env }) {
  if (!oauthConfigured(env)) return html("La integración OAuth no está configurada.", 503);
  const url = new URL(request.url);
  const state = await readState(url.searchParams.get("state"), env);
  const code = url.searchParams.get("code");
  if (!state || !code) return html("No pudimos verificar la autorización OAuth.", 400);
  const redirectUri = `${state.origin}/api/oauth/callback`;
  try {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: env.ZENDESK_OAUTH_CLIENT_ID, client_secret: env.ZENDESK_OAUTH_CLIENT_SECRET, redirect_uri: redirectUri });
    const response = await fetch(`${zendeskBase(env)}/oauth/tokens`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return html("Zendesk rechazó la autorización OAuth.", 502);
    const token = await response.json();
    if (typeof token?.access_token !== "string" || typeof token?.refresh_token !== "string") return html("Zendesk no entregó una credencial utilizable.", 502);
    await env.GAIA_OPTIONS.put("gaia-zendesk-oauth", JSON.stringify({ access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000 - 30000 }));
    return html("Zendesk quedó conectado. Puedes cerrar esta pestaña y volver a GAIA.");
  } catch { return html("No pudimos completar la conexión con Zendesk.", 502); }
}

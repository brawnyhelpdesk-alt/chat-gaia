import { authenticated } from "../_admin.js";
import { createState, oauthConfigured, zendeskBase } from "../_oauth.js";

export async function onRequestGet({ request, env }) {
  if (!oauthConfigured(env) || !await authenticated(request, env)) return new Response("No autorizado", { status: 401, headers: { "Cache-Control": "no-store" } });
  const origin = new URL(request.url).origin;
  const state = await createState(origin, env);
  const url = new URL(`${zendeskBase(env)}/oauth/authorizations/new`);
  url.search = new URLSearchParams({ response_type: "code", redirect_uri: `${origin}/api/oauth/callback`, client_id: env.ZENDESK_OAUTH_CLIENT_ID, scope: "users:read", state }).toString();
  return Response.redirect(url.toString(), 302);
}

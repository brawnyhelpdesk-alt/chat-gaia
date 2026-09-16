const encoder = new TextEncoder();

function base64(value) {
  let binary = "";
  for (const byte of encoder.encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function apiBase(env) {
  const subdomain = typeof env.ZENDESK_SUPPORT_SUBDOMAIN === "string" ? env.ZENDESK_SUPPORT_SUBDOMAIN.trim().toLowerCase() : "";
  return /^[a-z0-9-]{2,63}$/.test(subdomain) ? `https://${subdomain}.zendesk.com` : null;
}

function oauthReady(env) {
  return Boolean(apiBase(env) && env.GAIA_OPTIONS && typeof env.ZENDESK_OAUTH_CLIENT_ID === "string" && env.ZENDESK_OAUTH_CLIENT_ID && typeof env.ZENDESK_OAUTH_CLIENT_SECRET === "string" && env.ZENDESK_OAUTH_CLIENT_SECRET);
}

async function refreshToken(env, current) {
  const base = apiBase(env);
  if (!base || !current?.refresh_token) return null;
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refresh_token, client_id: env.ZENDESK_OAUTH_CLIENT_ID, client_secret: env.ZENDESK_OAUTH_CLIENT_SECRET });
  const response = await fetch(`${base}/oauth/tokens`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" }, body, signal: AbortSignal.timeout(6000) });
  if (!response.ok) return null;
  const token = await response.json();
  if (typeof token?.access_token !== "string" || !token.access_token) return null;
  const next = { access_token: token.access_token, refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : current.refresh_token, expires_at: Date.now() + Math.max(60, Number(token.expires_in) || 3600) * 1000 - 30000 };
  await env.GAIA_OPTIONS.put("gaia-zendesk-oauth", JSON.stringify(next));
  return next;
}

async function oauthToken(env) {
  if (!oauthReady(env)) return null;
  const current = await env.GAIA_OPTIONS.get("gaia-zendesk-oauth", "json");
  if (typeof current?.access_token === "string" && current.access_token && Number(current.expires_at) > Date.now()) return current;
  return refreshToken(env, current);
}

export async function existingZendeskUser(env, cedula) {
  const base = apiBase(env);
  if (!base) return { ok: false, error: "service_unavailable" };
  const oauth = await oauthToken(env);
  if (oauth) {
    try {
      let response = await fetch(`${base}/api/v2/users/search?external_id=${encodeURIComponent(cedula)}`, { headers: { "Authorization": `Bearer ${oauth.access_token}`, "Accept": "application/json" }, signal: AbortSignal.timeout(6000) });
      if (response.status === 401) {
        const renewed = await refreshToken(env, oauth);
        if (!renewed) return { ok: false, error: "service_unavailable" };
        response = await fetch(`${base}/api/v2/users/search?external_id=${encodeURIComponent(cedula)}`, { headers: { "Authorization": `Bearer ${renewed.access_token}`, "Accept": "application/json" }, signal: AbortSignal.timeout(6000) });
      }
      if (!response.ok) return { ok: false, error: "service_unavailable" };
      const data = await response.json();
      const users = Array.isArray(data?.users) ? data.users : [];
      const user = users.find((item) => item && String(item.external_id || "") === cedula && item.suspended !== true);
      return user ? { ok: true } : { ok: false, error: "user_not_found" };
    } catch { return { ok: false, error: "service_unavailable" }; }
  }
  const email = typeof env.ZENDESK_SUPPORT_EMAIL === "string" ? env.ZENDESK_SUPPORT_EMAIL : "";
  const token = typeof env.ZENDESK_SUPPORT_API_TOKEN === "string" ? env.ZENDESK_SUPPORT_API_TOKEN : "";
  if (!base || !email || !token) return { ok: false, error: "service_unavailable" };
  try {
    const response = await fetch(`${base}/api/v2/users/search?external_id=${encodeURIComponent(cedula)}`, {
      headers: { "Authorization": `Basic ${base64(`${email}/token:${token}`)}`, "Accept": "application/json" },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return { ok: false, error: "service_unavailable" };
    const data = await response.json();
    const users = Array.isArray(data?.users) ? data.users : [];
    const user = users.find((item) => item && String(item.external_id || "") === cedula && item.suspended !== true);
    return user ? { ok: true } : { ok: false, error: "user_not_found" };
  } catch { return { ok: false, error: "service_unavailable" }; }
}

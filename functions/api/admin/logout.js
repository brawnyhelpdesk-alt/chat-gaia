import { clearCookie, json, originAllowed } from "../_admin.js";

export async function onRequestPost({ request }) {
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
}

export async function onRequest({ request }) {
  if (request.method === "POST") return onRequestPost({ request });
  return json({ error: "method_not_allowed" }, 405);
}

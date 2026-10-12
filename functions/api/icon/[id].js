const ID_PATTERN = /^[a-z0-9_-]{12,64}$/i;

export async function onRequestGet({ params, env }) {
  const id = String(params.id || "");
  if (!ID_PATTERN.test(id) || !env.GAIA_OPTIONS) return new Response("Not found", { status: 404 });
  const bytes = await env.GAIA_OPTIONS.get(`gaia-icon:${id}`, "arrayBuffer");
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
}

export async function onRequest(context) {
  return context.request.method === "GET" ? onRequestGet(context) : new Response("Method not allowed", { status: 405 });
}

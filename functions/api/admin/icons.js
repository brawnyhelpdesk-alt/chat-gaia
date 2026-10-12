import { authenticated, json, originAllowed } from "../_admin.js";

const INDEX_KEY = "gaia-admin-icon-index";
const ID_PATTERN = /^[a-z0-9_-]{12,64}$/i;

async function permitted(request, env) {
  return originAllowed(request) && env.GAIA_OPTIONS && await authenticated(request, env);
}

async function index(env) {
  const value = await env.GAIA_OPTIONS.get(INDEX_KEY, "json");
  return Array.isArray(value) ? value.filter((item) => item && ID_PATTERN.test(item.id) && typeof item.name === "string").slice(0, 40) : [];
}

export async function onRequestGet({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  return json({ icons: await index(env) });
}

export async function onRequestPost({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "image/png") return json({ error: "png_required" }, 415);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 24 || bytes.length > 131072 || ![137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value) || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return json({ error: "invalid_png" }, 400);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  if (width < 16 || height < 16 || width > 512 || height > 512 || width !== height) return json({ error: "invalid_dimensions" }, 400);
  const icons = await index(env);
  if (icons.length >= 40) return json({ error: "icon_limit" }, 400);
  const id = crypto.randomUUID().replace(/-/g, "");
  const suppliedName = new URL(request.url).searchParams.get("name") || "Ícono PNG";
  const name = suppliedName.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60) || "Ícono PNG";
  await env.GAIA_OPTIONS.put(`gaia-icon:${id}`, bytes.buffer);
  icons.push({ id, name, width, height, createdAt: new Date().toISOString() });
  await env.GAIA_OPTIONS.put(INDEX_KEY, JSON.stringify(icons));
  return json({ icon: icons[icons.length - 1] }, 201);
}

export async function onRequestDelete({ request, env }) {
  if (!await permitted(request, env)) return json({ error: "unauthorized" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!ID_PATTERN.test(id)) return json({ error: "invalid_request" }, 400);
  const saved = await env.GAIA_OPTIONS.get("custom-options", "json");
  const reference = `png:${id}`;
  if (Object.values(saved?.icons || {}).includes(reference) || (saved?.options || []).some((item) => item?.icon === reference)) return json({ error: "icon_in_use" }, 409);
  await env.GAIA_OPTIONS.delete(`gaia-icon:${id}`);
  await env.GAIA_OPTIONS.put(INDEX_KEY, JSON.stringify((await index(env)).filter((item) => item.id !== id)));
  return json({ deleted: true });
}

export async function onRequest(context) {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  if (context.request.method === "DELETE") return onRequestDelete(context);
  return json({ error: "method_not_allowed" }, 405);
}

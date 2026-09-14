const encoder = new TextEncoder();
const PRODUCTION_ORIGIN = "https://gaia-ascendis.pages.dev";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function base64Url(value) {
  const bytes = value instanceof Uint8Array ? value : encoder.encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeCedula(value) {
  if (typeof value !== "string" || !/^[0-9\s\-\u2010-\u2015]*$/u.test(value)) return null;
  const digits = value.replace(/[\s\-\u2010-\u2015]/gu, "");
  return /^[0-9]{11}$/.test(digits) ? digits : null;
}

async function signJwt(payload, keyId, secret) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: keyId }));
  const claims = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput)));
  return `${signingInput}.${base64Url(signature)}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get("Origin");
  if (origin && origin !== PRODUCTION_ORIGIN) return json({ error: "forbidden" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "invalid_request" }, 415);
  }
  const contentLength = Number(request.headers.get("Content-Length") || "0");
  if (contentLength > 256) return json({ error: "invalid_request" }, 413);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const cedula = normalizeCedula(body?.cedula);
  if (!cedula) return json({ error: "invalid_request" }, 400);

  const secret = env.ZENDESK_MESSAGING_SECRET;
  const keyId = env.ZENDESK_MESSAGING_KEY_ID;
  if (typeof secret !== "string" || !secret || typeof keyId !== "string" || !keyId) {
    return json({ error: "service_unavailable" }, 503);
  }

  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt({
    scope: "user",
    external_id: cedula,
    iat: now,
    exp: now + 300
  }, keyId, secret);
  return json({ jwt: jwt }, 200);
}

export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "method_not_allowed" }, 405);
}

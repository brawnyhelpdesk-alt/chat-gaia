function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

function safeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object" || !/^[a-z0-9-]{2,40}$/i.test(item.id)) return [];
    const choices = Array.isArray(item.choices) ? item.choices.filter((choice) => typeof choice === "string" && choice.trim()).slice(0, 12).map((choice) => choice.trim().slice(0, 100)) : [];
    if (!choices.length) return [];
    return [{
      id: item.id.toLowerCase(),
      title: typeof item.title === "string" ? item.title.slice(0, 70) : "Nueva solicitud",
      description: typeof item.description === "string" ? item.description.slice(0, 120) : "Solicitud corporativa",
      question: typeof item.question === "string" ? item.question.slice(0, 140) : "¿Qué necesitas?",
      icon: typeof item.icon === "string" && (/^[a-z0-9-]{2,40}$/i.test(item.icon) || /^png:[a-z0-9_-]{12,64}$/i.test(item.icon)) ? item.icon.toLowerCase() : "sparkles",
      choices
    }];
  });
}

function safeIcons(value) {
  const permitted = new Set(["password", "access", "failure", "configuration", "equipment", "system", "consultation"]);
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, icon]) => permitted.has(key) && typeof icon === "string" && (/^[a-z0-9-]{2,40}$/i.test(icon) || /^png:[a-z0-9_-]{12,64}$/i.test(icon)) ? [[key, icon.toLowerCase()]] : []));
}

function safeLayout(saved, options) {
  const base = ["password", "access", "failure", "configuration", "equipment", "system", "consultation"];
  const allowed = new Set([...base, ...options.map((item) => `custom:${item.id}`)]);
  const order = Array.isArray(saved?.order) ? saved.order.filter((key) => allowed.has(key)) : [];
  for (const key of allowed) if (!order.includes(key)) order.push(key);
  const hidden = Array.isArray(saved?.hidden) ? [...new Set(saved.hidden.filter((key) => allowed.has(key)))] : [];
  return { order, hidden };
}

export async function onRequestGet({ env }) {
  try {
    const saved = env.GAIA_OPTIONS ? await env.GAIA_OPTIONS.get("custom-options", "json") : null;
    const options = safeOptions(saved?.options);
    return json({ options, icons: safeIcons(saved?.icons), ...safeLayout(saved, options), revision: Number(saved?.revision) || 0 });
  } catch {
    return json({ options: [], icons: {} });
  }
}

export async function onRequest({ request, env }) {
  if (request.method === "GET") return onRequestGet({ request, env });
  return json({ error: "method_not_allowed" }, 405);
}

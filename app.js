(function () {
  "use strict";

  function normalizeCedula(value) {
    if (typeof value !== "string" || !/^[0-9\s\-\u2010-\u2015]*$/u.test(value)) return null;
    const digits = value.replace(/[\s\-\u2010-\u2015]/gu, "");
    return /^[0-9]{11}$/.test(digits) ? digits : null;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { normalizeCedula };
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const FIELD_CEDULA = "55732322097179";
  const form = document.getElementById("identificacion");
  const input = document.getElementById("cedula");
  const fields = document.getElementById("datos-cedula");
  const button = document.getElementById("continuar");
  const notice = document.getElementById("aviso");
  const panel = document.getElementById("chat-panel");
  let widgetAvailable = false;
  let prepared = false;
  let attempt = 0;
  let timeout;

  function message(text, error) {
    notice.textContent = text;
    notice.className = error ? "notice error" : "notice";
  }

  function showLanding() {
    document.body.classList.remove("chat-active");
    panel.hidden = true;
    button.disabled = false;
    button.textContent = prepared ? "Volver al chat" : "Continuar con GAIA";
    button.focus();
  }

  function showChat() {
    panel.hidden = false;
    document.body.classList.add("chat-active");
  }

  function fail(current, text) {
    if (current !== attempt) return;
    attempt += 1; // Late SDK callbacks must not reopen a failed attempt.
    clearTimeout(timeout);
    showLanding();
    message(text, true);
  }

  function renderChat(current) {
    if (current !== attempt) return;
    showChat();
    window.zE("messenger", "render", {
      mode: "embedded",
      widget: { targetElement: "#gaia-chat" }
    }, function (error) {
      if (current !== attempt) return;
      if (error) {
        fail(current, "No pudimos abrir GAIA. Intenta de nuevo.");
        return;
      }
      clearTimeout(timeout);
      prepared = true;
      input.value = "";
      fields.hidden = true;
      button.disabled = false;
      button.textContent = "Volver al chat";
      message("Tu conversación con GAIA está abierta.");
    });
  }

  async function requestMessagingToken(cedula) {
    const response = await fetch("/api/gaia-token", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula: cedula })
    });
    if (!response.ok) throw new Error("token-request-failed");
    const body = await response.json();
    if (!body || typeof body.jwt !== "string" || body.jwt.length < 20) {
      throw new Error("invalid-token-response");
    }
    return body.jwt;
  }

  async function authenticateAndRender(current, cedula) {
    let jwt;
    try {
      jwt = await requestMessagingToken(cedula);
    } catch (error) {
      fail(current, "No pudimos verificar tu acceso. Intenta de nuevo.");
      return;
    }

    if (current !== attempt) return;
    try {
      window.zE("messenger", "loginUser", function (callback) {
        callback(jwt);
      }, function (error) {
        if (current !== attempt) return;
        if (error) {
          fail(current, "No pudimos verificar tu acceso. Intenta de nuevo.");
          return;
        }
        try {
          window.zE("messenger:set", "conversationFields", [{ id: FIELD_CEDULA, value: cedula }], function () {
            try { renderChat(current); }
            catch (renderError) { fail(current, "No pudimos abrir GAIA. Intenta de nuevo."); }
          });
        } catch (fieldError) {
          fail(current, "No pudimos preparar la conversación. Intenta de nuevo.");
        }
      });
    } catch (error) {
      fail(current, "No pudimos verificar tu acceso. Intenta de nuevo.");
    }
  }

  function connectWidget() {
    if (typeof window.zE !== "function") return false;
    window.zE("messenger:set", "locale", "es");
    window.zE("messenger:set", "cookies", "functional");
    window.zE("messenger:on", "close", showLanding);
    widgetAvailable = true;
    message("Ingresa tu cédula para continuar.");
    return true;
  }

  let checks = 0;
  const waiting = setInterval(function () {
    try {
      if (connectWidget()) clearInterval(waiting);
      else if (++checks >= 50) {
        clearInterval(waiting);
        message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true);
      }
    } catch (error) {
      clearInterval(waiting);
      message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true);
    }
  }, 300);

  input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
  document.getElementById("volver").addEventListener("click", showLanding);
  window.addEventListener("pagehide", function () { input.value = ""; });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (button.disabled) return;
    if (prepared) { showChat(); return; }
    const cedula = normalizeCedula(input.value);
    if (!cedula) {
      input.setAttribute("aria-invalid", "true");
      message("Ingresa los 11 dígitos de tu cédula, con o sin guiones. No incluyas letras.", true);
      input.focus();
      return;
    }
    if (!widgetAvailable) {
      message("GAIA todavía está cargando. Intenta de nuevo en un momento.", true);
      return;
    }
    button.disabled = true;
    message("Verificando tu acceso con GAIA…");
    const current = ++attempt;
    timeout = setTimeout(function () {
      fail(current, "GAIA está tardando en responder. Intenta de nuevo.");
    }, 20000);
    try {
      authenticateAndRender(current, cedula);
    } catch (error) {
      fail(current, "No pudimos preparar la conversación. Intenta de nuevo.");
    }
  });
})();

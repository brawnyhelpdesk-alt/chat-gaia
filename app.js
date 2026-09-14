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
  const flows = {
    password: { title: "¿De qué plataforma olvidaste la contraseña?", choices: ["Microsoft Office 365", "App Corripio", "IGC", "Telynet", "Microsoft Dynamics", "Otra aplicación"] },
    access: { title: "¿A qué necesitas acceso?", choices: ["App Corripio", "IGC", "Microsoft Office 365", "Microsoft Dynamics", "Carpetas compartidas", "Internet", "Otra aplicación"] },
    failure: { title: "¿Dónde ocurre la falla?", choices: ["Internet", "IGC", "Impresora", "Microsoft Office 365", "Microsoft Dynamics", "Telynet", "Antivirus", "Otro sistema o equipo"] },
    configuration: { title: "¿Qué necesitas configurar?", choices: ["Microsoft Office 365", "Antivirus", "Impresora", "Equipo de trabajo", "Zendesk", "Flotas", "Otra plataforma"] },
    equipment: { title: "¿Qué equipo o dispositivo necesitas?", choices: ["Laptop nueva", "Cambio de equipo", "Impresora", "Hand Held", "CPU", "Reporte de falla de equipo"] },
    system: { title: "¿Sobre qué sistema es tu solicitud?", choices: ["IGC", "Microsoft Dynamics", "Telynet", "App Corripio", "Base de Datos", "Zendesk", "Sistema diverso"] }
  };
  const flowLabels = { password: "Cambio de contraseña", access: "Solicitud de acceso", failure: "Reporte de falla", configuration: "Configuración", equipment: "Equipo o dispositivo", system: "Sistema o plataforma" };
  const form = document.getElementById("identificacion"), input = document.getElementById("cedula"), fields = document.getElementById("datos-cedula"), button = document.getElementById("continuar"), notice = document.getElementById("aviso"), panel = document.getElementById("chat-panel"), requestPanel = document.getElementById("request-panel"), detailPanel = document.getElementById("detail-panel"), confirmPanel = document.getElementById("confirm-panel"), detailTitle = document.getElementById("detalle-titulo"), detailChoices = document.getElementById("detail-choices"), selectionSummary = document.getElementById("selection-summary");
  let widgetAvailable = false, authenticated = false, currentCedula = "", selectedFlow = "", selectedChoice = "", attempt = 0, timeout;
  function message(text, error) { notice.textContent = text; notice.className = error ? "notice error" : "notice"; }
  function hideRequestPanels() { requestPanel.hidden = detailPanel.hidden = confirmPanel.hidden = true; }
  function showLanding() { document.body.classList.remove("chat-active"); panel.hidden = true; if (authenticated) { form.hidden = true; hideRequestPanels(); requestPanel.hidden = false; return; } form.hidden = false; fields.hidden = false; hideRequestPanels(); button.disabled = false; button.textContent = "Continuar con GAIA"; }
  function showChat() { panel.hidden = false; document.body.classList.add("chat-active"); }
  function fail(current, text) { if (current !== attempt) return; attempt += 1; clearTimeout(timeout); showLanding(); message(text, true); }
  function showFlow(flow) {
    selectedFlow = flow; selectedChoice = ""; requestPanel.hidden = confirmPanel.hidden = true; detailTitle.textContent = flows[flow].title; detailChoices.replaceChildren();
    flows[flow].choices.forEach(function (choice) { const option = document.createElement("button"); option.type = "button"; option.className = "detail-choice"; option.textContent = choice; option.addEventListener("click", function () { selectedChoice = choice; detailPanel.hidden = true; selectionSummary.textContent = `${flowLabels[selectedFlow]} · ${choice}`; confirmPanel.hidden = false; }); detailChoices.appendChild(option); });
    detailPanel.hidden = false;
  }
  function renderChat(current) { if (current !== attempt) return; showChat(); window.zE("messenger", "render", { mode: "embedded", widget: { targetElement: "#gaia-chat" } }, function (error) { if (current !== attempt) return; if (error) { fail(current, "No pudimos abrir GAIA. Intenta de nuevo."); return; } clearTimeout(timeout); input.value = ""; button.disabled = false; message("Tu conversación con GAIA está abierta."); }); }
  async function requestMessagingToken(cedula) { const response = await fetch("/api/gaia-token", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: cedula }) }); if (!response.ok) throw new Error("token-request-failed"); const body = await response.json(); if (!body || typeof body.jwt !== "string" || body.jwt.length < 20) throw new Error("invalid-token-response"); return body.jwt; }
  async function authenticate(current, cedula) { let jwt; try { jwt = await requestMessagingToken(cedula); } catch { fail(current, "No pudimos verificar tu acceso. Intenta de nuevo."); return; } if (current !== attempt) return; try { window.zE("messenger", "loginUser", function (callback) { callback(jwt); }, function (error) { if (current !== attempt) return; if (error) { fail(current, "No pudimos verificar tu acceso. Intenta de nuevo."); return; } clearTimeout(timeout); authenticated = true; currentCedula = cedula; button.disabled = false; form.hidden = true; message(""); showLanding(); }); } catch { fail(current, "No pudimos verificar tu acceso. Intenta de nuevo."); } }
  function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }
  function openExistingConversations() { if (!authenticated || !currentCedula) return; const current = ++attempt; timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000); try { window.zE("messenger:set", "conversationFields", [{ id: FIELD_CEDULA, value: currentCedula }], function () { renderChat(current); }); } catch { fail(current, "No pudimos preparar la conversación. Intenta de nuevo."); } }
  function startNewConversation() {
    if (!authenticated || !currentCedula || !selectedFlow || !selectedChoice) return;
    const current = ++attempt;
    const requestType = flowLabels[selectedFlow];
    const initialMessage = `Nueva solicitud: ${requestType}\nPlataforma o equipo: ${selectedChoice}\nPor favor, guíame con este caso.`;
    timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000);
    try {
      window.zE("messenger:set", "conversationFields", [{ id: FIELD_CEDULA, value: currentCedula }], function () {
        window.zE("messenger:set", "conversationTags", ["gaia", `gaia_${slug(selectedFlow)}`, `gaia_${slug(selectedChoice)}`]);
        window.zE("messenger:set", "conversationMetadata", { source: "gaia_web", request_type: requestType, platform: selectedChoice });
        showChat();
        window.zE("messenger", "render", { mode: "embedded", widget: { targetElement: "#gaia-chat" } }, function (renderError) {
          if (current !== attempt) return;
          if (renderError) { fail(current, "No pudimos abrir GAIA. Intenta de nuevo."); return; }
          window.zE("messenger", "newConversation", { displayName: "Solicitud con GAIA", metadata: { source: "gaia_web", request_type: requestType, platform: selectedChoice }, message: { content: { type: "text", text: initialMessage }, metadata: { source: "gaia_web", request_type: requestType, platform: selectedChoice } } }, function (conversationError, conversation) {
            if (current !== attempt) return;
            if (conversationError) { fail(current, "No pudimos iniciar tu nueva solicitud. Intenta de nuevo."); return; }
            window.zE("messenger:ui", "navigation", { screen: "Conversation", options: { conversationId: conversation.id } });
            clearTimeout(timeout); input.value = ""; button.disabled = false; message("Tu nueva solicitud fue enviada a GAIA.");
          });
        });
      });
    } catch { fail(current, "No pudimos preparar tu nueva solicitud. Intenta de nuevo."); }
  }
  function connectWidget() { if (typeof window.zE !== "function") return false; window.zE("messenger:set", "locale", "es"); window.zE("messenger:set", "cookies", "functional"); window.zE("messenger:on", "close", showLanding); widgetAvailable = true; message("Ingresa tu cédula para continuar."); return true; }
  let checks = 0; const waiting = setInterval(function () { try { if (connectWidget()) clearInterval(waiting); else if (++checks >= 50) { clearInterval(waiting); message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true); } } catch { clearInterval(waiting); message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true); } }, 300);
  input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
  document.querySelectorAll("[data-flow]").forEach(function (choice) { choice.addEventListener("click", function () { showFlow(choice.dataset.flow); }); });
  document.getElementById("volver-solicitudes").addEventListener("click", showLanding); document.getElementById("cambiar-solicitud").addEventListener("click", function () { showFlow(selectedFlow); }); document.getElementById("abrir-solicitud").addEventListener("click", startNewConversation); document.getElementById("mis-conversaciones").addEventListener("click", openExistingConversations); document.getElementById("volver").addEventListener("click", showLanding); window.addEventListener("pagehide", function () { input.value = ""; });
  form.addEventListener("submit", function (event) { event.preventDefault(); if (button.disabled) return; const cedula = normalizeCedula(input.value); if (!cedula) { input.setAttribute("aria-invalid", "true"); message("Ingresa los 11 dígitos de tu cédula, con o sin guiones. No incluyas letras.", true); input.focus(); return; } if (!widgetAvailable) { message("GAIA todavía está cargando. Intenta de nuevo en un momento.", true); return; } button.disabled = true; message("Verificando tu acceso con GAIA…"); const current = ++attempt; timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000); authenticate(current, cedula); });
})();

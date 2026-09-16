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
    system: { title: "¿Sobre qué sistema es tu solicitud?", choices: ["IGC", "Microsoft Dynamics", "Telynet", "App Corripio", "Base de Datos", "Zendesk"] }
  };
  const flowLabels = { password: "Cambio de contraseña", access: "Solicitud de acceso", failure: "Reporte de falla", configuration: "Configuración", equipment: "Equipo o dispositivo", system: "Sistema o plataforma" };
  const defaultIcons = { password: "key", access: "access", failure: "alert", configuration: "settings", equipment: "laptop", system: "system", consultation: "consultation" };
  const form = document.getElementById("identificacion"), input = document.getElementById("cedula"), fields = document.getElementById("datos-cedula"), pinFields = document.getElementById("datos-pin"), pinInput = document.getElementById("pin"), pinConfirm = document.getElementById("confirmar-pin"), pinConfirmBox = document.getElementById("confirmacion-pin"), pinLabel = document.getElementById("etiqueta-pin"), pinHelp = document.getElementById("ayuda-pin"), button = document.getElementById("continuar"), notice = document.getElementById("aviso"), panel = document.getElementById("chat-panel"), requestPanel = document.getElementById("request-panel"), detailPanel = document.getElementById("detail-panel"), confirmPanel = document.getElementById("confirm-panel"), detailTitle = document.getElementById("detalle-titulo"), detailChoices = document.getElementById("detail-choices"), selectionSummary = document.getElementById("selection-summary"), customOptions = document.getElementById("custom-options");
  const touchKeypad = document.getElementById("touch-keypad");
  const showKeypadButton = document.getElementById("mostrar-teclado"), hideKeypadButton = document.getElementById("ocultar-teclado");
  let keypadTarget = input;
  let widgetAvailable = false, authenticated = false, currentCedula = "", selectedFlow = "", selectedChoice = "", pinMode = "cedula", attempt = 0, timeout, inactivityTimer, awaitingReply = false;
  function message(text, error) { notice.textContent = text; notice.className = error ? "notice error" : "notice"; }
  function setIcon(target, name) { if (!target) return; target.replaceChildren(); if (typeof window.gaiaIconElement === "function") target.appendChild(window.gaiaIconElement(name)); }
  function applyIcons(overrides) {
    document.querySelectorAll("[data-option-key]").forEach(function (button) {
      const key = button.dataset.optionKey, icon = button.querySelector(".choice-icon");
      setIcon(icon, overrides?.[key] || defaultIcons[key] || "sparkles");
    });
  }
  function hideRequestPanels() { requestPanel.hidden = detailPanel.hidden = confirmPanel.hidden = true; }
  function activateKeypad(target) { if (!touchKeypad || !target) return; keypadTarget = target; }
  function showKeypad(target) { activateKeypad(target); if (!touchKeypad) return; touchKeypad.hidden = false; if (showKeypadButton) showKeypadButton.setAttribute("aria-expanded", "true"); }
  function hideKeypad() { if (!touchKeypad) return; touchKeypad.hidden = true; if (showKeypadButton) showKeypadButton.setAttribute("aria-expanded", "false"); }
  function showLanding() { document.body.classList.remove("chat-active"); panel.hidden = true; if (authenticated) { form.hidden = true; hideRequestPanels(); requestPanel.hidden = false; return; } form.hidden = false; fields.hidden = pinMode !== "cedula"; pinFields.hidden = pinMode === "cedula"; pinConfirmBox.hidden = pinMode !== "enroll"; hideRequestPanels(); button.disabled = false; button.textContent = pinMode === "enroll" ? "Crear PIN y continuar" : pinMode === "verify" ? "Ingresar a GAIA" : "Continuar con GAIA"; activateKeypad(pinMode === "cedula" ? input : pinInput); }
  function showChat() { panel.hidden = false; document.body.classList.add("chat-active"); }
  function fail(current, text) { if (current !== attempt) return; attempt += 1; clearTimeout(timeout); showLanding(); message(text, true); }
  function clearInactivityTimer() { clearTimeout(inactivityTimer); inactivityTimer = undefined; }
  function endSession(text) {
    clearInactivityTimer(); awaitingReply = false; authenticated = false; currentCedula = ""; selectedFlow = ""; selectedChoice = ""; pinMode = "cedula"; pinInput.value = ""; pinConfirm.value = ""; attempt += 1;
    try { window.zE("messenger", "logoutUser"); } catch {}
    showLanding(); message(text, false); input.focus();
  }
  function startInactivityTimer() {
    clearInactivityTimer(); awaitingReply = true;
    inactivityTimer = setTimeout(function () { if (awaitingReply) endSession("Tu sesión se cerró por falta de respuesta. Ingresa tu cédula para volver a iniciar."); }, 5 * 60 * 1000);
  }
  function showFlow(flow) {
    selectedFlow = flow; selectedChoice = ""; requestPanel.hidden = confirmPanel.hidden = true; detailTitle.textContent = flows[flow].title; detailChoices.replaceChildren();
    flows[flow].choices.forEach(function (choice) { const option = document.createElement("button"); option.type = "button"; option.className = "detail-choice"; option.textContent = choice; option.addEventListener("click", function () { selectedChoice = choice; detailPanel.hidden = true; selectionSummary.textContent = `${flowLabels[selectedFlow]} · ${choice}`; confirmPanel.hidden = false; }); detailChoices.appendChild(option); });
    detailPanel.hidden = false;
  }
  function addCustomOption(option) {
    if (!option || typeof option !== "object" || !/^[a-z0-9_-]{2,40}$/i.test(option.id) || !Array.isArray(option.choices) || !option.choices.length) return;
    const key = `custom_${option.id.toLowerCase()}`;
    if (flows[key]) return;
    const title = String(option.title || "Nueva solicitud").slice(0, 70);
    const question = String(option.question || "¿Qué necesitas?").slice(0, 140);
    const description = String(option.description || "Solicitud corporativa").slice(0, 120);
    const choices = option.choices.filter(function (choice) { return typeof choice === "string" && choice.trim().length; }).slice(0, 12).map(function (choice) { return choice.trim().slice(0, 100); });
    if (!choices.length) return;
    flows[key] = { title: question, choices: choices };
    flowLabels[key] = title;
    const optionButton = document.createElement("button");
    optionButton.className = "quick-choice";
    optionButton.type = "button";
    optionButton.dataset.flow = key;
    const icon = document.createElement("span"), optionTitle = document.createElement("strong"), optionDescription = document.createElement("small");
    icon.className = "choice-icon";
    icon.setAttribute("aria-hidden", "true");
    setIcon(icon, option.icon || "sparkles");
    optionTitle.textContent = title;
    optionDescription.textContent = description;
    optionButton.append(icon, optionTitle, optionDescription);
    optionButton.addEventListener("click", function () { showFlow(key); });
    customOptions.appendChild(optionButton);
  }
  async function loadCustomOptions() {
    try {
      const response = await fetch("/api/options", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      if (!config) return;
      applyIcons(config.icons);
      if (Array.isArray(config.options)) config.options.forEach(addCustomOption);
    } catch {}
  }
  function renderChat(current) { if (current !== attempt) return; showChat(); window.zE("messenger", "render", { mode: "embedded", widget: { targetElement: "#gaia-chat" } }, function (error) { if (current !== attempt) return; if (error) { fail(current, "No pudimos abrir GAIA. Intenta de nuevo."); return; } clearTimeout(timeout); input.value = ""; button.disabled = false; message("Tu conversación con GAIA está abierta."); }); }
  async function pinRequest(body) { const response = await fetch("/api/pin", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || "pin_request_failed"); error.code = data.error; throw error; } return data; }
  async function requestMessagingToken(cedula, pin) { const response = await fetch("/api/gaia-token", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula: cedula, pin: pin }) }); const body = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(body.error || "token-request-failed"); error.code = body.error; throw error; } if (!body || typeof body.jwt !== "string" || body.jwt.length < 20) throw new Error("invalid-token-response"); return body.jwt; }
  async function authenticate(current, cedula, pin) { let jwt; try { jwt = await requestMessagingToken(cedula, pin); } catch (error) { const texts = { invalid_pin: "El PIN no es correcto. Intenta de nuevo.", locked: "Por seguridad, espera 15 minutos antes de volver a intentar.", pin_not_set: "Debes crear tu PIN antes de continuar." }; fail(current, texts[error.code] || "No pudimos verificar tu acceso. Intenta de nuevo."); return; } if (current !== attempt) return; try { window.zE("messenger", "loginUser", function (callback) { callback(jwt); }, function (error) { if (current !== attempt) return; if (error) { fail(current, "No pudimos verificar tu acceso. Intenta de nuevo."); return; } clearTimeout(timeout); authenticated = true; currentCedula = cedula; button.disabled = false; form.hidden = true; message(""); showLanding(); }); } catch { fail(current, "No pudimos verificar tu acceso. Intenta de nuevo."); } }
  function slug(value) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40); }
  function openExistingConversations() { if (!authenticated || !currentCedula) return; const current = ++attempt; timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000); try { window.zE("messenger:set", "conversationFields", [{ id: FIELD_CEDULA, value: currentCedula }], function () { renderChat(current); }); } catch { fail(current, "No pudimos preparar la conversación. Intenta de nuevo."); } }
  function startConsultation() {
    if (!authenticated || !currentCedula) return;
    const current = ++attempt;
    timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000);
    try {
      window.zE("messenger:set", "conversationFields", [{ id: FIELD_CEDULA, value: currentCedula }], function () {
        window.zE("messenger:set", "conversationTags", ["gaia", "gaia_consulta"]);
        window.zE("messenger:set", "conversationMetadata", { source: "gaia_web", request_type: "Consulta" });
        showChat();
        window.zE("messenger", "render", { mode: "embedded", widget: { targetElement: "#gaia-chat" } }, function (renderError) {
          if (current !== attempt) return;
          if (renderError) { fail(current, "No pudimos abrir GAIA. Intenta de nuevo."); return; }
          window.zE("messenger", "newConversation", { displayName: "Consulta con GAIA", metadata: { source: "gaia_web", request_type: "Consulta" } }, function (conversationError, conversation) {
            if (current !== attempt) return;
            if (conversationError) { fail(current, "No pudimos abrir la consulta. Intenta de nuevo."); return; }
            window.zE("messenger:ui", "navigation", { screen: "Conversation", options: { conversationId: conversation.id } });
            clearTimeout(timeout); input.value = ""; button.disabled = false; startInactivityTimer(); message("Escribe tu consulta para que GAIA pueda ayudarte.");
          });
        });
      });
    } catch { fail(current, "No pudimos preparar la consulta. Intenta de nuevo."); }
  }
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
            clearTimeout(timeout); input.value = ""; button.disabled = false; startInactivityTimer(); message("Tu nueva solicitud fue enviada a GAIA.");
          });
        });
      });
    } catch { fail(current, "No pudimos preparar tu nueva solicitud. Intenta de nuevo."); }
  }
  function connectWidget() { if (typeof window.zE !== "function") return false; window.zE("messenger:set", "locale", "es"); window.zE("messenger:set", "cookies", "functional"); window.zE("messenger:on", "close", showLanding); window.zE("messenger:set", "beforeMessageSent", function (outgoingMessage) { if (awaitingReply) { awaitingReply = false; clearInactivityTimer(); } return outgoingMessage; }); widgetAvailable = true; message("Ingresa tu cédula para continuar."); return true; }
  let checks = 0; const waiting = setInterval(function () { try { if (connectWidget()) clearInterval(waiting); else if (++checks >= 50) { clearInterval(waiting); message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true); } } catch { clearInterval(waiting); message("No pudimos cargar GAIA. Actualiza la página e intenta de nuevo.", true); } }, 300);
  input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); });
  [pinInput, pinConfirm].forEach(function (element) { element.addEventListener("input", function () { element.removeAttribute("aria-invalid"); }); });
  [input, pinInput, pinConfirm].forEach(function (element) { element.addEventListener("focus", function () { showKeypad(element); }); });
  if (showKeypadButton) showKeypadButton.addEventListener("click", function () { showKeypad(pinMode === "cedula" ? input : pinInput); (pinMode === "cedula" ? input : pinInput).focus({ preventScroll: true }); });
  if (hideKeypadButton) hideKeypadButton.addEventListener("click", hideKeypad);
  if (touchKeypad) touchKeypad.querySelectorAll("[data-keypad-key]").forEach(function (key) { key.addEventListener("click", function () { const value = key.dataset.keypadKey; if (!keypadTarget) return; if (value === "clear") keypadTarget.value = ""; else if (value === "backspace") keypadTarget.value = keypadTarget.value.slice(0, -1); else if (keypadTarget.value.length < Number(keypadTarget.maxLength || 99)) keypadTarget.value += value; keypadTarget.dispatchEvent(new Event("input", { bubbles: true })); keypadTarget.focus({ preventScroll: true }); }); });
  document.querySelectorAll("[data-flow]").forEach(function (choice) { choice.addEventListener("click", function () { showFlow(choice.dataset.flow); }); });
  document.getElementById("hacer-consulta").addEventListener("click", startConsultation);
  document.getElementById("volver-solicitudes").addEventListener("click", showLanding); document.getElementById("cambiar-solicitud").addEventListener("click", function () { showFlow(selectedFlow); }); document.getElementById("abrir-solicitud").addEventListener("click", startNewConversation); document.getElementById("mis-conversaciones").addEventListener("click", openExistingConversations); document.getElementById("volver").addEventListener("click", showLanding); document.getElementById("cerrar-sesion").addEventListener("click", function () { endSession("Tu sesión fue cerrada."); }); window.addEventListener("pagehide", function () { clearInactivityTimer(); input.value = ""; });
  form.addEventListener("submit", async function (event) {
    event.preventDefault(); if (button.disabled) return;
    if (pinMode === "cedula") {
      const cedula = normalizeCedula(input.value);
      if (!cedula) { input.setAttribute("aria-invalid", "true"); message("Ingresa los 11 dígitos de tu cédula, con o sin guiones. No incluyas letras.", true); input.focus(); return; }
      button.disabled = true; message("Verificando tu acceso…");
      try { const status = await pinRequest({ action: "status", cedula: cedula }); currentCedula = cedula; pinMode = status.enrolled ? "verify" : "enroll"; pinLabel.textContent = pinMode === "enroll" ? "Crea tu PIN personal" : "Tu PIN"; pinHelp.textContent = pinMode === "enroll" ? "Será tu clave personal de 4 dígitos para entrar a GAIA." : "Ingresa tu PIN personal de 4 dígitos."; showLanding(); pinInput.focus(); message(""); } catch { button.disabled = false; message("No pudimos verificar tu acceso. Intenta de nuevo.", true); }
      return;
    }
    const pin = pinInput.value;
    if (!/^[0-9]{4}$/.test(pin)) { pinInput.setAttribute("aria-invalid", "true"); message("El PIN debe tener 4 dígitos.", true); pinInput.focus(); return; }
    if (pinMode === "enroll" && pin !== pinConfirm.value) { pinConfirm.setAttribute("aria-invalid", "true"); message("Los PIN no coinciden.", true); pinConfirm.focus(); return; }
    if (!widgetAvailable) { message("GAIA todavía está cargando. Intenta de nuevo en un momento.", true); return; }
    button.disabled = true; const current = ++attempt; timeout = setTimeout(function () { fail(current, "GAIA está tardando en responder. Intenta de nuevo."); }, 20000);
    try { if (pinMode === "enroll") await pinRequest({ action: "enroll", cedula: currentCedula, pin: pin }); authenticate(current, currentCedula, pin); }
    catch (error) { if (error.code === "already_enrolled") { pinMode = "verify"; showLanding(); message("El PIN ya fue creado. Ingresa tu PIN para continuar.", true); } else fail(current, "No pudimos crear tu PIN. Intenta de nuevo."); }
  });
  applyIcons(); loadCustomOptions();
})();

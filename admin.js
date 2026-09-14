(function () {
  "use strict";
  const loginCard = document.getElementById("login-card"), adminCard = document.getElementById("admin-card"), loginForm = document.getElementById("login-form"), loginPassword = document.getElementById("admin-password"), loginNotice = document.getElementById("login-notice"), optionForm = document.getElementById("option-form"), optionList = document.getElementById("option-list"), optionNotice = document.getElementById("option-notice"), saveButton = document.getElementById("save-options");
  let options = [];
  function note(target, text, error) { target.textContent = text; target.className = error ? "notice error" : "notice"; }
  function render() {
    optionList.replaceChildren();
    if (!options.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Aún no hay opciones adicionales."; optionList.appendChild(empty); return; }
    options.forEach(function (option, index) {
      const item = document.createElement("article"), heading = document.createElement("h3"), details = document.createElement("p"), remove = document.createElement("button");
      item.className = "saved-option"; heading.textContent = option.title; details.textContent = `${option.question} · ${option.choices.length} alternativas`; remove.type = "button"; remove.className = "remove-button"; remove.textContent = "Eliminar";
      remove.addEventListener("click", function () { options.splice(index, 1); render(); note(optionNotice, "Hay cambios sin publicar."); });
      item.append(heading, details, remove); optionList.appendChild(item);
    });
  }
  async function request(url, method, body) {
    const response = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || "request_failed");
    return data;
  }
  async function openAdmin() {
    const data = await request("/api/admin/options", "GET");
    options = Array.isArray(data.options) ? data.options : [];
    loginCard.hidden = true; adminCard.hidden = false; render();
  }
  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault(); note(loginNotice, "");
    try { await request("/api/admin/login", "POST", { password: loginPassword.value }); loginPassword.value = ""; await openAdmin(); }
    catch (error) { note(loginNotice, error.message === "invalid_credentials" ? "No pudimos validar la credencial." : "El panel no está disponible. Verifica su configuración.", true); }
  });
  optionForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const title = document.getElementById("option-title").value.trim(), id = document.getElementById("option-id").value.trim().toLowerCase(), description = document.getElementById("option-description").value.trim(), question = document.getElementById("option-question").value.trim();
    const choices = document.getElementById("option-choices").value.split(/\r?\n/).map(function (choice) { return choice.trim(); }).filter(Boolean);
    if (!/^[a-z0-9-]{2,40}$/.test(id) || !title || !description || !question || !choices.length || choices.length > 12 || options.some(function (option) { return option.id === id; })) { note(optionNotice, "Revisa el identificador y las alternativas antes de agregar la opción.", true); return; }
    if (options.length >= 10) { note(optionNotice, "Solo se permiten diez opciones adicionales.", true); return; }
    options.push({ id, title, description, question, choices }); optionForm.reset(); render(); note(optionNotice, "Opción agregada. Guarda los cambios para publicarla.");
  });
  saveButton.addEventListener("click", async function () {
    saveButton.disabled = true; note(optionNotice, "Guardando cambios…");
    try { const data = await request("/api/admin/options", "PUT", { options }); options = data.options; render(); note(optionNotice, "Cambios publicados en GAIA."); }
    catch { note(optionNotice, "No pudimos publicar los cambios. Inicia sesión de nuevo e intenta otra vez.", true); }
    finally { saveButton.disabled = false; }
  });
  document.getElementById("logout").addEventListener("click", async function () { try { await request("/api/admin/logout", "POST"); } catch {} options = []; adminCard.hidden = true; loginCard.hidden = false; loginPassword.focus(); });
})();

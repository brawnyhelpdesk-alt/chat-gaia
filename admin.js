(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const catalog = window.GAIA_ICON_CATALOG || { sparkles: "Nuevo" };
  const defaults = { password: "key", access: "access", failure: "alert", configuration: "settings", equipment: "laptop", system: "system", consultation: "consultation" };
  const base = [
    { id: "password", title: "Olvidé mi contraseña", description: "Restablecer acceso" },
    { id: "access", title: "Necesito acceso", description: "Aplicación, carpeta o internet" },
    { id: "failure", title: "Reportar una falla", description: "Internet, sistema o equipo" },
    { id: "configuration", title: "Configuración", description: "Equipo, Office o antivirus" },
    { id: "equipment", title: "Equipo o dispositivo", description: "Solicitud, cambio o impresora" },
    { id: "system", title: "Sistema o plataforma", description: "IGC, Dynamics, Telynet y más" },
    { id: "consultation", title: "Hacer consulta", description: "Pregunta lo que necesites a GAIA" }
  ];
  let options = [], icons = {}, order = [], hidden = [], uploadedIcons = [], kiosk = { width: 1024, height: 768 }, revision = 0, updatedAt = null, editingIndex = -1, dirty = false, inactivityTimer, mfaEnrollmentToken = null;

  function note(target, text, error) { target.textContent = text; target.className = error ? "notice error" : "notice"; }
  function normalizeCedula(value) { return typeof value === "string" && /^[0-9\s\-\u2010-\u2015]*$/u.test(value) && /^[0-9]{11}$/.test(value.replace(/[\s\-\u2010-\u2015]/gu, "")) ? value.replace(/[\s\-\u2010-\u2015]/gu, "") : null; }
  function iconReference(item) { return item.base ? (icons[item.id] || defaults[item.id]) : (item.option.icon || "sparkles"); }
  function iconNode(reference) {
    const box = document.createElement("span"); box.className = "icon-preview";
    if (String(reference).startsWith("png:")) { const image = document.createElement("img"); image.src = `/api/icon/${reference.slice(4)}`; image.alt = ""; box.appendChild(image); }
    else if (window.gaiaIconElement) box.appendChild(window.gaiaIconElement(reference));
    return box;
  }
  function iconChoices(select, selected) {
    select.replaceChildren();
    const built = document.createElement("optgroup"); built.label = "Íconos corporativos";
    Object.entries(catalog).forEach(([id, label]) => { const option = document.createElement("option"); option.value = id; option.textContent = label; built.appendChild(option); });
    select.appendChild(built);
    if (uploadedIcons.length) {
      const png = document.createElement("optgroup"); png.label = "Imágenes PNG";
      uploadedIcons.forEach((item) => { const option = document.createElement("option"); option.value = `png:${item.id}`; option.textContent = item.name; png.appendChild(option); });
      select.appendChild(png);
    }
    select.value = selected && [...select.options].some((option) => option.value === selected) ? selected : "sparkles";
  }
  function keyItems() {
    const map = new Map(base.map((item) => [item.id, { ...item, base: true }]));
    options.forEach((option) => map.set(`custom:${option.id}`, { id: `custom:${option.id}`, title: option.title, description: option.description, option, base: false }));
    const complete = [...order.filter((key) => map.has(key)), ...[...map.keys()].filter((key) => !order.includes(key))];
    order = [...new Set(complete)];
    hidden = hidden.filter((key) => map.has(key));
    return { map, items: order.map((key) => map.get(key)) };
  }
  function metrics() {
    $("metric-total").textContent = order.length;
    $("metric-visible").textContent = order.length - hidden.length;
    $("metric-custom").textContent = options.length;
    $("metric-revision").textContent = revision;
    $("publish-meta").textContent = updatedAt ? `Última publicación: ${new Date(updatedAt).toLocaleString("es-DO")} · versión ${revision}` : "Todavía no se han publicado cambios desde el panel.";
  }
  function markDirty(message) {
    dirty = true; $("save-options").disabled = false; $("dirty-state").textContent = message || "Hay cambios pendientes de publicación."; $("dirty-state").className = "dirty"; metrics();
  }
  function markClean() { dirty = false; $("save-options").disabled = true; $("dirty-state").textContent = "No hay cambios pendientes."; $("dirty-state").className = ""; metrics(); }
  function move(key, delta) { const index = order.indexOf(key), next = index + delta; if (index < 0 || next < 0 || next >= order.length) return; [order[index], order[next]] = [order[next], order[index]]; renderOrder(); markDirty("Cambiaste el orden del catálogo."); }
  function setItemIcon(item, value) { if (item.base) icons[item.id] = value; else item.option.icon = value; }
  function renderOrder() {
    const container = $("catalog-order-list"), { items } = keyItems(); container.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("article"); row.className = "catalog-row"; row.draggable = true; row.dataset.key = item.id;
      const handle = document.createElement("button"); handle.type = "button"; handle.className = "drag-handle"; handle.textContent = "⋮⋮"; handle.title = "Arrastrar para reordenar"; handle.setAttribute("aria-label", `Mover ${item.title}`);
      const main = document.createElement("div"); main.className = "catalog-main"; const title = document.createElement("strong"), description = document.createElement("small"); title.textContent = item.title; description.textContent = item.description; main.append(title, description);
      const picker = document.createElement("select"); picker.setAttribute("aria-label", `Ícono de ${item.title}`); iconChoices(picker, iconReference(item)); picker.addEventListener("change", () => { setItemIcon(item, picker.value); renderOrder(); markDirty("Cambiaste un ícono."); });
      const visibility = document.createElement("label"); visibility.className = "visibility-toggle"; const check = document.createElement("input"); check.type = "checkbox"; check.checked = !hidden.includes(item.id); check.addEventListener("change", () => { hidden = check.checked ? hidden.filter((key) => key !== item.id) : [...new Set([...hidden, item.id])]; row.style.opacity = check.checked ? "1" : ".55"; markDirty(check.checked ? "Mostraste una opción." : "Ocultaste una opción."); }); visibility.append(check, document.createTextNode("Visible"));
      const actions = document.createElement("div"); actions.className = "row-actions"; const up = document.createElement("button"), down = document.createElement("button"); up.type = down.type = "button"; up.textContent = "↑"; down.textContent = "↓"; up.title = "Subir"; down.title = "Bajar"; up.disabled = index === 0; down.disabled = index === items.length - 1; up.addEventListener("click", () => move(item.id, -1)); down.addEventListener("click", () => move(item.id, 1)); actions.append(up, down, visibility);
      row.style.opacity = check.checked ? "1" : ".55"; row.append(handle, iconNode(iconReference(item)), main, picker, actions);
      row.addEventListener("dragstart", (event) => { row.classList.add("dragging"); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", item.id); });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
      row.addEventListener("drop", (event) => { event.preventDefault(); const source = event.dataTransfer.getData("text/plain"), target = item.id; if (!source || source === target) return; const sourceIndex = order.indexOf(source), targetIndex = order.indexOf(target); order.splice(sourceIndex, 1); order.splice(targetIndex, 0, source); renderOrder(); markDirty("Cambiaste el orden del catálogo."); });
      container.appendChild(row);
    });
    metrics();
  }
  function renderOptions() {
    const container = $("option-list"); container.replaceChildren();
    if (!options.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "Aún no hay opciones personalizadas."; container.appendChild(empty); return; }
    options.forEach((item, index) => {
      const row = document.createElement("article"); row.className = "saved-option";
      const content = document.createElement("div"), title = document.createElement("h3"), detail = document.createElement("p"); title.textContent = item.title; detail.textContent = `${item.question} · ${item.choices.length} alternativas`; content.append(title, detail);
      const actions = document.createElement("div"); actions.className = "saved-actions"; const edit = document.createElement("button"), remove = document.createElement("button"); edit.type = remove.type = "button"; edit.className = "quiet-button"; remove.className = "danger-button"; edit.textContent = "Editar"; remove.textContent = "Eliminar";
      edit.addEventListener("click", () => openOptionForm(index));
      remove.addEventListener("click", () => { if (!window.confirm(`¿Eliminar “${item.title}”? El cambio no será público hasta guardar.`)) return; const key = `custom:${item.id}`; options.splice(index, 1); order = order.filter((value) => value !== key); hidden = hidden.filter((value) => value !== key); renderAll(); markDirty("Eliminaste una opción personalizada."); });
      actions.append(edit, remove); row.append(iconNode(item.icon), content, actions); container.appendChild(row);
    });
  }
  function renderUploadedIcons() {
    const container = $("uploaded-icons"); container.replaceChildren();
    if (!uploadedIcons.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No hay imágenes PNG cargadas."; container.appendChild(empty); }
    uploadedIcons.forEach((item) => {
      const card = document.createElement("article"); card.className = "uploaded-icon"; const image = document.createElement("img"); image.src = `/api/icon/${item.id}`; image.alt = ""; const info = document.createElement("div"), name = document.createElement("strong"), size = document.createElement("small"); name.textContent = item.name; size.textContent = `${item.width} × ${item.height} px`; info.append(name, size); const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.title = "Eliminar imagen"; remove.addEventListener("click", async () => { if (!window.confirm(`¿Eliminar la imagen “${item.name}”? Solo es posible si no está en uso.`)) return; try { await api(`/api/admin/icons?id=${encodeURIComponent(item.id)}`, "DELETE"); uploadedIcons = uploadedIcons.filter((icon) => icon.id !== item.id); renderAll(); note($("icon-notice"), "Imagen eliminada."); } catch (error) { note($("icon-notice"), error.message === "icon_in_use" ? "La imagen está en uso. Cambia primero los íconos que la utilizan." : "No pudimos eliminar la imagen.", true); } }); card.append(image, info, remove); container.appendChild(card);
    });
    iconChoices($("option-icon"), $("option-icon").value);
  }
  function renderAll() { renderOrder(); renderOptions(); renderUploadedIcons(); metrics(); }
  function openOptionForm(index) {
    editingIndex = Number.isInteger(index) ? index : -1; const item = editingIndex >= 0 ? options[editingIndex] : null; $("option-form").hidden = false; $("option-form-mode").textContent = item ? "EDITAR OPCIÓN" : "NUEVA OPCIÓN"; $("option-form-title").textContent = item ? item.title : "Crear opción"; $("submit-option").textContent = item ? "Guardar edición" : "Agregar opción"; $("option-id").disabled = !!item; $("option-title").value = item?.title || ""; $("option-id").value = item?.id || ""; $("option-description").value = item?.description || ""; $("option-question").value = item?.question || ""; $("option-choices").value = item?.choices?.join("\n") || ""; iconChoices($("option-icon"), item?.icon || "sparkles"); $("option-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function closeOptionForm() { editingIndex = -1; $("option-form").reset(); $("option-form").hidden = true; $("option-id").disabled = false; note($("option-notice"), ""); }
  async function api(url, method, body) { const response = await fetch(url, { method, credentials: "same-origin", headers: body !== undefined ? { "Content-Type": "application/json" } : {}, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(data.error || "request_failed"); error.status = response.status; throw error; } return data; }
  function clearDeviceEnrollment() { $("mfa-device-secret").value = ""; $("mfa-device-qr").replaceChildren(); $("mfa-device-setup").hidden = true; }
  function renderMfa(status) { const enabled = !!status?.enabled; $("mfa-status").textContent = enabled ? "Activado" : "No configurado"; $("mfa-status").className = enabled ? "status-pill enabled" : "status-pill disabled"; $("begin-mfa").hidden = enabled; $("mfa-manage").hidden = !enabled; if (!enabled) { $("mfa-setup").hidden = true; clearDeviceEnrollment(); } }
  function renderEnrollmentQr(uri, targetId) { const target = $(targetId || "mfa-qr"); target.replaceChildren(); if (typeof window.qrcode !== "function") return; const qr = window.qrcode(0, "M"); qr.addData(uri); qr.make(); target.innerHTML = qr.createSvgTag({ scalable: true, margin: 2, title: "Escanear configuración de GAIA" }); }
  async function enrollmentCodeMatches(secret, code) {
    try {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = 0, value = 0; const output = [];
      for (const letter of secret.toUpperCase()) { const index = alphabet.indexOf(letter); if (index < 0) return false; value = (value << 5) | index; bits += 5; if (bits >= 8) { output.push((value >>> (bits - 8)) & 255); bits -= 8; } }
      const key = await crypto.subtle.importKey("raw", new Uint8Array(output), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]), current = Math.floor(Date.now() / 30000);
      for (let drift = -1; drift <= 1; drift += 1) { const message = new Uint8Array(8); let counter = BigInt(current + drift); for (let index = 7; index >= 0; index -= 1) { message[index] = Number(counter & 255n); counter >>= 8n; } const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message)), offset = signature[signature.length - 1] & 15, number = ((signature[offset] & 127) << 24) | (signature[offset + 1] << 16) | (signature[offset + 2] << 8) | signature[offset + 3]; if (String(number % 1000000).padStart(6, "0") === code) return true; }
      return false;
    } catch { return null; }
  }
  async function open() {
    const [data, kioskData, iconData, mfaData] = await Promise.all([api("/api/admin/options", "GET"), api("/api/admin/kiosk", "GET"), api("/api/admin/icons", "GET"), api("/api/admin/mfa", "GET")]);
    options = Array.isArray(data.options) ? data.options : []; icons = data.icons || {}; order = Array.isArray(data.order) ? data.order : []; hidden = Array.isArray(data.hidden) ? data.hidden : []; revision = Number(data.revision) || 0; updatedAt = data.updatedAt || null; uploadedIcons = Array.isArray(iconData.icons) ? iconData.icons : []; kiosk = kioskData.settings || kiosk; $("kiosk-width").value = kiosk.width; $("kiosk-height").value = kiosk.height; $("restore-options").disabled = !data.canRestore; $("login-card").hidden = true; $("admin-card").hidden = false; renderMfa(mfaData); renderAll(); markClean(); resetInactivity();
  }
  function resetInactivity() { if ($("admin-card").hidden) return; clearTimeout(inactivityTimer); inactivityTimer = setTimeout(() => logout("La sesión se cerró después de 20 minutos sin actividad."), 20 * 60 * 1000); }
  async function logout(message) { try { await api("/api/admin/logout", "POST"); } catch {} clearTimeout(inactivityTimer); options = []; icons = {}; clearDeviceEnrollment(); $("admin-card").hidden = true; $("login-card").hidden = false; $("login-mfa").hidden = true; $("admin-mfa-code").value = ""; $("admin-password").value = ""; note($("login-notice"), message || "Sesión cerrada."); $("admin-password").focus(); }

  $("login-form").addEventListener("submit", async (event) => { event.preventDefault(); const submit = event.submitter; submit.disabled = true; note($("login-notice"), "Verificando…"); try { await api("/api/admin/login", "POST", { password: $("admin-password").value, code: $("login-mfa").hidden ? undefined : $("admin-mfa-code").value.trim() }); $("admin-password").value = ""; $("admin-mfa-code").value = ""; await open(); } catch (error) { if (error.message === "mfa_required") { $("login-mfa").hidden = false; $("admin-mfa-code").focus(); note($("login-notice"), "Ingresa el código temporal para completar el acceso."); } else if (error.message === "invalid_mfa") note($("login-notice"), "El código temporal o de recuperación no es válido.", true); else if (error.message === "rate_limited") note($("login-notice"), "Demasiados intentos. Espera cinco minutos.", true); else note($("login-notice"), error.message === "invalid_credentials" ? "No pudimos validar la credencial." : "El panel no está disponible. Verifica su configuración.", true); } finally { submit.disabled = false; } });
  document.querySelectorAll(".admin-tab").forEach((tab) => tab.addEventListener("click", () => { document.querySelectorAll(".admin-tab").forEach((item) => { const active = item === tab; item.classList.toggle("active", active); item.setAttribute("aria-selected", String(active)); }); document.querySelectorAll(".tab-panel").forEach((panel) => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; }); }));
  $("new-option").addEventListener("click", () => openOptionForm());
  $("cancel-option").addEventListener("click", closeOptionForm);
  $("option-form").addEventListener("submit", (event) => { event.preventDefault(); const title = $("option-title").value.trim(), id = $("option-id").value.trim().toLowerCase(), description = $("option-description").value.trim(), question = $("option-question").value.trim(), choices = $("option-choices").value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean); if (!/^[a-z0-9-]{2,40}$/.test(id) || !title || !description || !question || !choices.length || choices.length > 12 || (editingIndex < 0 && options.some((item) => item.id === id))) return note($("option-notice"), "Revisa el identificador y las alternativas antes de guardar.", true); if (editingIndex < 0 && options.length >= 10) return note($("option-notice"), "Solo se permiten diez opciones adicionales.", true); const item = { id, title, description, question, choices, icon: $("option-icon").value }, wasEditing = editingIndex >= 0; if (wasEditing) options[editingIndex] = item; else { options.push(item); order.push(`custom:${id}`); } closeOptionForm(); renderAll(); markDirty(wasEditing ? "Editaste una opción." : "Agregaste una opción nueva."); });
  $("save-options").addEventListener("click", async () => { const button = $("save-options"); button.disabled = true; $("dirty-state").textContent = "Publicando cambios…"; try { const data = await api("/api/admin/options", "PUT", { options, icons, order, hidden }); options = data.options; icons = data.icons; order = data.order; hidden = data.hidden; revision = data.revision; updatedAt = data.updatedAt; $("restore-options").disabled = !data.canRestore; renderAll(); markClean(); note($("option-notice"), "Cambios publicados en GAIA."); } catch { button.disabled = false; $("dirty-state").textContent = "No pudimos publicar. Revisa la sesión e intenta nuevamente."; $("dirty-state").className = "dirty"; } });
  $("restore-options").addEventListener("click", async () => { if (!window.confirm("¿Restaurar la versión anterior del catálogo? La configuración actual quedará como copia recuperable.")) return; try { const data = await api("/api/admin/options", "POST", { action: "restore" }); options = data.options || []; icons = data.icons || {}; order = data.order || []; hidden = data.hidden || []; revision = data.revision || revision; updatedAt = data.updatedAt; renderAll(); markClean(); note($("option-notice"), "Versión anterior restaurada."); } catch { note($("option-notice"), "No pudimos restaurar la versión anterior.", true); } });
  $("icon-upload-form").addEventListener("submit", async (event) => { event.preventDefault(); const file = $("icon-file").files[0], name = $("icon-name").value.trim() || file?.name?.replace(/\.png$/i, "") || "Ícono PNG"; if (!file || file.type !== "image/png" || file.size > 131072) return note($("icon-notice"), "Selecciona un PNG válido de hasta 128 KB.", true); const submit = event.submitter; submit.disabled = true; note($("icon-notice"), "Validando y cargando…"); try { const response = await fetch(`/api/admin/icons?name=${encodeURIComponent(name)}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "image/png" }, body: file, cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "upload_failed"); uploadedIcons.push(data.icon); event.target.reset(); renderAll(); note($("icon-notice"), "Imagen PNG agregada al catálogo."); } catch (error) { const messages = { invalid_dimensions: "La imagen debe medir entre 16 y 512 px.", invalid_png: "El archivo no es un PNG válido.", icon_limit: "La biblioteca llegó al límite de 40 imágenes." }; note($("icon-notice"), messages[error.message] || "No pudimos cargar la imagen.", true); } finally { submit.disabled = false; } });
  $("reset-pin").addEventListener("click", async () => { const cedula = normalizeCedula($("pin-cedula").value); if (!cedula) return note($("pin-notice"), "Ingresa una cédula válida de 11 dígitos.", true); const button = $("reset-pin"); button.disabled = true; try { await api("/api/admin/pins", "POST", { cedula }); $("pin-cedula").value = ""; note($("pin-notice"), "PIN restablecido. La persona podrá crear uno nuevo al entrar."); } catch { note($("pin-notice"), "No pudimos restablecer el PIN.", true); } finally { button.disabled = false; } });
  $("password-form").addEventListener("submit", async (event) => { event.preventDefault(); const currentPassword = $("current-admin-password").value, newPassword = $("new-admin-password").value, confirmation = $("confirm-admin-password").value, target = $("password-notice"), submit = event.submitter; if (newPassword.length < 16 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) return note(target, "La nueva contraseña debe tener 16 caracteres y combinar mayúsculas, minúsculas, números y símbolos.", true); if (newPassword !== confirmation) return note(target, "Las contraseñas nuevas no coinciden.", true); submit.disabled = true; try { await api("/api/admin/password", "POST", { currentPassword, newPassword, confirmation }); event.target.reset(); note(target, "Contraseña administrativa actualizada."); } catch { note(target, "No pudimos cambiar la contraseña. Verifica la actual.", true); } finally { submit.disabled = false; } });
  $("save-kiosk").addEventListener("click", async () => { const width = Number($("kiosk-width").value), height = Number($("kiosk-height").value); if (!Number.isInteger(width) || !Number.isInteger(height) || width < 640 || width > 3840 || height < 480 || height > 2160) return note($("kiosk-notice"), "Usa un ancho entre 640 y 3840, y un alto entre 480 y 2160 píxeles.", true); const button = $("save-kiosk"); button.disabled = true; try { const data = await api("/api/admin/kiosk", "PUT", { settings: { width, height } }); kiosk = data.settings; note($("kiosk-notice"), `Kiosco ajustado a ${kiosk.width} × ${kiosk.height}.`); } catch { note($("kiosk-notice"), "No pudimos guardar el tamaño.", true); } finally { button.disabled = false; } });
  async function startMfaEnrollment() { try { const data = await api("/api/admin/mfa", "POST", { action: "begin" }); mfaEnrollmentToken = data.enrollmentToken; $("mfa-secret").value = data.secret; $("mfa-enable-code").value = ""; renderEnrollmentQr(data.uri); $("mfa-setup").hidden = false; $("begin-mfa").hidden = true; $("mfa-enable-code").focus(); note($("mfa-notice"), "Escanea el QR en ambos celulares y confirma uno de los códigos antes de 15 minutos."); } catch { note($("mfa-notice"), "No pudimos iniciar la configuración.", true); } }
  $("begin-mfa").addEventListener("click", startMfaEnrollment);
  $("restart-mfa").addEventListener("click", () => { if (window.confirm("¿Descartar esta clave y generar una nueva? También deberás reemplazarla en los dos celulares.")) startMfaEnrollment(); });
  $("enable-mfa").addEventListener("click", async () => { const code = $("mfa-enable-code").value.trim(), secret = $("mfa-secret").value; if (!/^[0-9]{6}$/.test(code)) return note($("mfa-notice"), "Ingresa el código de 6 dígitos.", true); if (!mfaEnrollmentToken || !secret) return note($("mfa-notice"), "Genera una clave de configuración nueva para continuar.", true); const matches = await enrollmentCodeMatches(secret, code); if (matches === false) return note($("mfa-notice"), "Ese código no pertenece al QR o clave que aparece en pantalla. Elimina la cuenta anterior del autenticador, escanea este QR y usa el código nuevo.", true); try { const data = await api("/api/admin/mfa", "POST", { action: "enable", code, enrollmentToken: mfaEnrollmentToken }); mfaEnrollmentToken = null; $("mfa-secret").value = ""; $("mfa-enable-code").value = ""; $("mfa-qr").replaceChildren(); $("mfa-setup").hidden = true; $("recovery-codes").textContent = data.recoveryCodes.join("\n"); $("mfa-recovery").hidden = false; renderMfa({ enabled: true }); note($("mfa-notice"), "Autenticador activado."); } catch { note($("mfa-notice"), "La configuración venció o el servidor no pudo validar el código. Genera una clave nueva e intenta otra vez.", true); } });
  $("dismiss-recovery").addEventListener("click", () => { $("mfa-recovery").hidden = true; $("recovery-codes").textContent = ""; });
  async function manageMfa(action) { const currentPassword = $("mfa-current-password").value, code = $("mfa-current-code").value.trim(); if (!currentPassword || !code) return note($("mfa-notice"), "Ingresa la contraseña actual y el código del autenticador.", true); try { const data = await api("/api/admin/mfa", "POST", { action, currentPassword, code }); $("mfa-current-password").value = $("mfa-current-code").value = ""; if (action === "disable") { renderMfa({ enabled: false }); note($("mfa-notice"), "Autenticador desactivado. Puedes configurarlo nuevamente cuando quieras."); } else { $("recovery-codes").textContent = data.recoveryCodes.join("\n"); $("mfa-recovery").hidden = false; note($("mfa-notice"), "Códigos de recuperación reemplazados."); } } catch { note($("mfa-notice"), "No pudimos validar la contraseña y el código.", true); } }
  $("add-mfa-device").addEventListener("click", async () => { const currentPassword = $("mfa-current-password").value, code = $("mfa-current-code").value.trim(), button = $("add-mfa-device"); if (!currentPassword || !/^[0-9]{6}$/.test(code)) return note($("mfa-notice"), "Para agregar otro celular ingresa la contraseña y el código de 6 dígitos del autenticador actual.", true); button.disabled = true; try { const data = await api("/api/admin/mfa", "POST", { action: "device", currentPassword, code }); $("mfa-current-password").value = $("mfa-current-code").value = ""; $("mfa-device-secret").value = data.secret; renderEnrollmentQr(data.uri, "mfa-device-qr"); $("mfa-device-setup").hidden = false; $("mfa-device-setup").scrollIntoView({ behavior: "smooth", block: "center" }); note($("mfa-notice"), "Escanea el QR en el otro celular. Ambos generarán códigos válidos."); } catch { clearDeviceEnrollment(); note($("mfa-notice"), "No pudimos validar la contraseña y el código de 6 dígitos actual.", true); } finally { button.disabled = false; } });
  $("finish-mfa-device").addEventListener("click", () => { clearDeviceEnrollment(); note($("mfa-notice"), "Segundo celular agregado. Ya puedes usar el código de cualquiera de los dos."); });
  $("regenerate-recovery").addEventListener("click", () => manageMfa("recovery")); $("disable-mfa").addEventListener("click", () => { if (window.confirm("¿Desactivar el segundo factor? El panel quedará protegido solo por la contraseña.")) manageMfa("disable"); });
  $("logout").addEventListener("click", () => logout("Sesión cerrada."));
  ["pointerdown", "keydown", "scroll"].forEach((eventName) => window.addEventListener(eventName, resetInactivity, { passive: true }));
  iconChoices($("option-icon"), "sparkles");
})();

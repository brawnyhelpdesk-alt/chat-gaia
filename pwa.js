(function () {
  "use strict";
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  const banner = document.getElementById("install-app"), button = document.getElementById("install-app-button"), close = document.getElementById("install-app-close");
  if (!banner || !button || window.matchMedia("(display-mode: standalone)").matches) return;
  let promptEvent;
  function show() { banner.hidden = false; }
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); promptEvent = event; show(); });
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (ios) { button.hidden = true; banner.querySelector("[data-install-text]").textContent = "En Safari, toca Compartir y luego ‘Añadir a pantalla de inicio’."; show(); }
  button.addEventListener("click", async () => { if (!promptEvent) return; promptEvent.prompt(); await promptEvent.userChoice; promptEvent = undefined; banner.hidden = true; });
  close.addEventListener("click", () => { banner.hidden = true; });
})();

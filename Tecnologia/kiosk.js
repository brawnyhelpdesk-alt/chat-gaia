(function () {
  "use strict";
  const defaults = { width: 1024, height: 768 };
  function apply(settings) {
    const width = Number(settings?.width) || defaults.width;
    const height = Number(settings?.height) || defaults.height;
    document.documentElement.style.setProperty("--kiosk-width", String(width));
    document.documentElement.style.setProperty("--kiosk-height", String(height));
    document.body.dataset.kioskResolution = `${width}x${height}`;
    const label = document.getElementById("kiosk-resolution");
    if (label) label.textContent = `Pantalla ${width} × ${height}`;
  }
  apply(defaults);
  fetch("/api/admin/kiosk", { cache: "no-store", credentials: "same-origin" })
    .then((response) => response.ok ? response.json() : null)
    .then((data) => { if (data?.settings) apply(data.settings); })
    .catch(() => {});
})();

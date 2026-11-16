/* Absolute-Max W3 — OpenSpecs explorer split from eos.js */
window.initEosOpenSpecsExplorer = function initEosOpenSpecsExplorer() {
  // OpenSpecs Interactive Explorer (SPEC-129)
  let allSpecsCatalog = [];
  let currentSpecFilter = "ALL";
  const specsGrid = document.getElementById("specs-grid-container");
  const specsSearchInput = document.getElementById("specs-search-input");
  const specFilterButtons = document.querySelectorAll("[data-spec-filter]");

  function renderSpecsGrid() {
    if (!specsGrid) return;
    const cleanQ = (specsSearchInput?.value || "").trim().toLowerCase();
    const cleanStatus = currentSpecFilter.toUpperCase();

    const filtered = allSpecsCatalog.filter((spec) => {
      const matchStatus = cleanStatus === "ALL" || (spec.status && spec.status.toUpperCase() === cleanStatus);
      const matchQuery = !cleanQ || spec.id.toLowerCase().includes(cleanQ) || spec.title.toLowerCase().includes(cleanQ);
      return matchStatus && matchQuery;
    });

    specsGrid.replaceChildren();
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText =
        "grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); font-family: var(--font-mono);";
      empty.textContent = "No se encontraron especificaciones que coincidan con la búsqueda.";
      specsGrid.appendChild(empty);
      return;
    }

    for (const spec of filtered) {
      const card = document.createElement("div");
      card.className = "spec-card";
      card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="spec-card__id">${spec.id}</span>
        <span style="font-family:var(--font-mono);font-size:0.64rem;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.14);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);">${spec.status}</span>
      </div>
      <div class="spec-card__title">${spec.title}</div>
      <div class="spec-card__meta">
        <span>📐 ${spec.frCount} EARS</span>
        <span>🧪 ${spec.bddCount} BDD</span>
        <a href="https://github.com/valentinflorezarbelaez-ai/Eos-System/blob/main/${spec.file}" target="_blank" rel="noopener noreferrer" style="margin-left:auto;color:#38bdf8;text-decoration:none;">Ver Spec ↗</a>
      </div>
    `;
      specsGrid.appendChild(card);
    }
  }

  function syncSpecsFilterAllLabel() {
    const allBtn = document.getElementById("specs-filter-all");
    if (!allBtn) return;
    const n = Array.isArray(allSpecsCatalog) ? allSpecsCatalog.length : 0;
    allBtn.textContent = n > 0 ? `Todas (${n})` : "Todas";
  }

  async function loadSpecsCatalog() {
    try {
      const res = await fetch("/api/specs", { headers: { Accept: "application/json" } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.specs)) {
          allSpecsCatalog = data.specs;
          syncSpecsFilterAllLabel();
          renderSpecsGrid();
          return;
        }
      }
    } catch {
      // Fallback
    }
  }

  if (specsSearchInput) {
    specsSearchInput.addEventListener("input", renderSpecsGrid);
  }

  specFilterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      specFilterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSpecFilter = btn.getAttribute("data-spec-filter") || "ALL";
      renderSpecsGrid();
    });
  });

  loadSpecsCatalog();
};

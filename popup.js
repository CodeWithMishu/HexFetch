const STORAGE_KEY = "hexfetchSavedPalettes";
const LAST_SCAN_KEY = "hexfetchLastScan";
const SETTINGS_KEY = "hexfetchSettings";

const DEFAULT_SETTINGS = {
  defaultSort: "usage-desc",
  defaultContrastMode: "normal",
  maxSwatches: 120
};

const state = {
  palette: null,
  inspectorEnabled: false,
  activeTab: null,
  activeRoleFilter: "all",
  savedPalettes: [],
  activeContrastFilter: "all",
  contrastLargeText: false,
  paletteSearchTerm: "",
  paletteSortMode: "usage-desc",
  settings: { ...DEFAULT_SETTINGS }
};

const ui = {
  scanColorsBtn: document.getElementById("scanColorsBtn"),
  toggleInspectorBtn: document.getElementById("toggleInspectorBtn"),
  copyAllBtn: document.getElementById("copyAllBtn"),
  exportCssBtn: document.getElementById("exportCssBtn"),
  exportTailwindBtn: document.getElementById("exportTailwindBtn"),
  exportContrastReportBtn: document.getElementById("exportContrastReportBtn"),
  savePaletteBtn: document.getElementById("savePaletteBtn"),
  exportSavedJsonBtn: document.getElementById("exportSavedJsonBtn"),
  importSavedJsonBtn: document.getElementById("importSavedJsonBtn"),
  importSavedJsonInput: document.getElementById("importSavedJsonInput"),
  settingsDefaultSort: document.getElementById("settingsDefaultSort"),
  settingsContrastMode: document.getElementById("settingsContrastMode"),
  settingsMaxSwatches: document.getElementById("settingsMaxSwatches"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  scanMeta: document.getElementById("scanMeta"),
  paletteSearchInput: document.getElementById("paletteSearchInput"),
  paletteSortSelect: document.getElementById("paletteSortSelect"),
  paletteGrid: document.getElementById("paletteGrid"),
  gradientList: document.getElementById("gradientList"),
  contrastList: document.getElementById("contrastList"),
  savedPalettes: document.getElementById("savedPalettes"),
  statusMessage: document.getElementById("statusMessage"),
  roleFilterButtons: Array.from(document.querySelectorAll("[data-role-filter]")),
  contrastFilterButtons: Array.from(document.querySelectorAll("[data-contrast-filter]")),
  contrastSizeButtons: Array.from(document.querySelectorAll("[data-contrast-size]"))
};

function setStatus(message, isError = false) {
  ui.statusMessage.textContent = message;
  ui.statusMessage.classList.toggle("error", isError);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.activeTab = tab;
  return tab;
}

function sendTabMessage(tabId, payload) {
  return chrome.tabs.sendMessage(tabId, payload);
}

function isRestrictedUrl(url) {
  const value = (url || "").toLowerCase();
  return (
    value.startsWith("chrome://") ||
    value.startsWith("chrome-extension://") ||
    value.startsWith("edge://") ||
    value.startsWith("about:") ||
    value.startsWith("view-source:")
  );
}

async function ensureContentScriptReady(tab) {
  if (!tab || !tab.id) {
    throw new Error("No active tab available.");
  }

  if (isRestrictedUrl(tab.url)) {
    throw new Error("HexFetch cannot run on this browser page. Open a normal website and try again.");
  }

  try {
    const ping = await sendTabMessage(tab.id, { type: "HEXFETCH_PING" });
    if (ping && ping.ok) {
      return;
    }
  } catch {
    // Retry after explicit script injection below.
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  const retryPing = await sendTabMessage(tab.id, { type: "HEXFETCH_PING" });
  if (!retryPing || !retryPing.ok) {
    throw new Error("Unable to initialize HexFetch on this page.");
  }
}

async function withReadyContentScript(task) {
  const tab = state.activeTab || (await getActiveTab());
  await ensureContentScriptReady(tab);
  return task(tab);
}

async function safeWriteClipboard(text) {
  await navigator.clipboard.writeText(text);
}

function renderPalette(colors) {
  const filteredColors = getVisiblePaletteColors(colors).slice(0, state.settings.maxSwatches);
  ui.paletteGrid.innerHTML = "";

  if (!filteredColors.length) {
    ui.paletteGrid.innerHTML = '<p class="swatch-count">No colors found for this filter.</p>';
    return;
  }

  for (const color of filteredColors) {
    const item = document.createElement("article");
    item.className = "swatch";

    const preview = document.createElement("div");
    preview.className = "swatch-preview";
    preview.style.backgroundColor = color.hex;

    const meta = document.createElement("div");
    meta.className = "swatch-meta";

    const hex = document.createElement("p");
    hex.className = "swatch-hex";
    hex.textContent = color.hex;

    const count = document.createElement("p");
    count.className = "swatch-count";
    count.textContent = `${color.count} uses`;

    const copyChip = document.createElement("button");
    copyChip.className = "copy-chip";
    copyChip.type = "button";
    copyChip.textContent = "Copy";

    copyChip.addEventListener("click", async () => {
      await safeWriteClipboard(color.hex);
      copyChip.textContent = "Copied";
      copyChip.classList.add("copied");
      setTimeout(() => {
        copyChip.textContent = "Copy";
        copyChip.classList.remove("copied");
      }, 700);
    });

    meta.append(hex, count);
    item.append(preview, meta, copyChip);
    ui.paletteGrid.appendChild(item);
  }
}

function sanitizeSettings(settings) {
  const incoming = settings || {};
  const maxSwatchesRaw = Number.parseInt(incoming.maxSwatches, 10);
  const maxSwatches = Number.isNaN(maxSwatchesRaw)
    ? DEFAULT_SETTINGS.maxSwatches
    : Math.max(20, Math.min(500, maxSwatchesRaw));

  const defaultSort = typeof incoming.defaultSort === "string"
    ? incoming.defaultSort
    : DEFAULT_SETTINGS.defaultSort;
  const defaultContrastMode = incoming.defaultContrastMode === "large" ? "large" : "normal";

  return {
    defaultSort,
    defaultContrastMode,
    maxSwatches
  };
}

function syncSettingsForm() {
  ui.settingsDefaultSort.value = state.settings.defaultSort;
  ui.settingsContrastMode.value = state.settings.defaultContrastMode;
  ui.settingsMaxSwatches.value = String(state.settings.maxSwatches);
}

function applySettingsToState() {
  state.paletteSortMode = state.settings.defaultSort;
  state.contrastLargeText = state.settings.defaultContrastMode === "large";
  ui.paletteSortSelect.value = state.paletteSortMode;
  updateContrastControlUI();
}

async function loadSettings() {
  const result = await chrome.storage.local.get([SETTINGS_KEY]);
  state.settings = sanitizeSettings(result[SETTINGS_KEY]);
  applySettingsToState();
  syncSettingsForm();
}

async function saveSettings() {
  const next = sanitizeSettings({
    defaultSort: ui.settingsDefaultSort.value,
    defaultContrastMode: ui.settingsContrastMode.value,
    maxSwatches: ui.settingsMaxSwatches.value
  });

  state.settings = next;
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  applySettingsToState();
  syncSettingsForm();

  if (state.palette) {
    renderPalette(state.palette.colors);
    renderContrast(state.palette);
  }

  setStatus("Settings saved.");
}

function getVisiblePaletteColors(colors) {
  const roleFiltered = getFilteredColors(colors, state.activeRoleFilter);
  const query = state.paletteSearchTerm.trim().toLowerCase();

  const searched = query
    ? roleFiltered.filter((entry) => entry.hex.toLowerCase().includes(query))
    : roleFiltered;

  const sorted = [...searched];

  if (state.paletteSortMode === "usage-desc") {
    sorted.sort((a, b) => b.count - a.count);
    return sorted;
  }

  if (state.paletteSortMode === "usage-asc") {
    sorted.sort((a, b) => a.count - b.count);
    return sorted;
  }

  if (state.paletteSortMode === "hex-asc") {
    sorted.sort((a, b) => a.hex.localeCompare(b.hex));
    return sorted;
  }

  if (state.paletteSortMode === "hex-desc") {
    sorted.sort((a, b) => b.hex.localeCompare(a.hex));
    return sorted;
  }

  if (state.paletteSortMode === "luminance-asc") {
    sorted.sort((a, b) => {
      const l1 = HexFetchUtils.relativeLuminance(a.hex) ?? 0;
      const l2 = HexFetchUtils.relativeLuminance(b.hex) ?? 0;
      return l1 - l2;
    });
    return sorted;
  }

  if (state.paletteSortMode === "luminance-desc") {
    sorted.sort((a, b) => {
      const l1 = HexFetchUtils.relativeLuminance(a.hex) ?? 0;
      const l2 = HexFetchUtils.relativeLuminance(b.hex) ?? 0;
      return l2 - l1;
    });
    return sorted;
  }

  return sorted;
}

function setScanMeta(message) {
  ui.scanMeta.textContent = message;
}

function getFilteredColors(colors, role) {
  if (!Array.isArray(colors)) {
    return [];
  }

  if (role === "all") {
    return colors;
  }

  return colors.filter((entry) => entry.roles && entry.roles[role] > 0);
}

function updateRoleFilterUI() {
  for (const button of ui.roleFilterButtons) {
    button.classList.toggle("active", button.dataset.roleFilter === state.activeRoleFilter);
  }
}

function renderGradients(gradients) {
  ui.gradientList.innerHTML = "";

  if (!gradients || !gradients.length) {
    ui.gradientList.innerHTML = '<p class="swatch-count">No gradients detected.</p>';
    return;
  }

  for (const gradient of gradients) {
    const item = document.createElement("article");
    item.className = "gradient-item";

    const preview = document.createElement("div");
    preview.className = "gradient-preview";
    preview.style.background = gradient.gradient;

    const stops = document.createElement("p");
    stops.className = "gradient-stops";
    stops.textContent = gradient.stops.join("  ");

    item.append(preview, stops);
    ui.gradientList.appendChild(item);
  }
}

function getContrastCandidates(colors) {
  const safeColors = Array.isArray(colors) ? colors : [];
  const textColors = safeColors.filter((entry) => entry.roles && entry.roles.text > 0).slice(0, 6);
  const backgroundColors = safeColors.filter((entry) => entry.roles && entry.roles.background > 0).slice(0, 6);

  const fallback = safeColors.slice(0, 6);

  return {
    text: textColors.length ? textColors : fallback,
    background: backgroundColors.length ? backgroundColors : fallback
  };
}

function renderContrast(palette) {
  ui.contrastList.innerHTML = "";

  if (!palette || !Array.isArray(palette.colors) || !palette.colors.length) {
    ui.contrastList.innerHTML = '<p class="swatch-count">No contrast data yet.</p>';
    return;
  }

  const pairs = getContrastPairs(palette);

  if (!pairs.length) {
    ui.contrastList.innerHTML = '<p class="swatch-count">No contrast pairs detected.</p>';
    return;
  }

  const filteredPairs = getFilteredContrastPairs(pairs);

  if (!filteredPairs.length) {
    ui.contrastList.innerHTML = '<p class="swatch-count">No pairs match this contrast filter.</p>';
    return;
  }

  for (const pair of filteredPairs.slice(0, 12)) {
    const item = document.createElement("article");
    item.className = "contrast-item";

    const preview = document.createElement("div");
    preview.className = "contrast-preview";
    preview.style.color = pair.textHex;
    preview.style.backgroundColor = pair.backgroundHex;
    preview.textContent = "Aa Sample";

    const meta = document.createElement("div");
    meta.className = "contrast-meta";

    const colors = document.createElement("p");
    colors.className = "contrast-colors";
    colors.textContent = `${pair.textHex} on ${pair.backgroundHex}`;

    const score = document.createElement("p");
    score.className = "contrast-score";
    score.textContent = `${pair.ratio.toFixed(2)}:1`;

    const badge = document.createElement("span");
    badge.className = `wcag-badge ${pair.rating.pass ? "" : "fail"}`.trim();
    badge.textContent = pair.rating.label;

    const actions = document.createElement("div");
    actions.className = "contrast-actions";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "contrast-copy";
    copyBtn.textContent = "Copy Tokens";
    copyBtn.addEventListener("click", async () => {
      const snippet = [
        ":root {",
        `  --text-color: ${pair.textHex};`,
        `  --bg-color: ${pair.backgroundHex};`,
        "}"
      ].join("\n");
      await safeWriteClipboard(snippet);
      setStatus(`Copied contrast tokens ${pair.textHex} on ${pair.backgroundHex}.`);
    });

    actions.appendChild(copyBtn);

    meta.append(colors, score, badge);
    item.append(preview, meta, actions);
    ui.contrastList.appendChild(item);
  }
}

function getContrastPairs(palette) {
  if (!palette || !Array.isArray(palette.colors) || !palette.colors.length) {
    return [];
  }

  const candidates = getContrastCandidates(palette.colors);
  const pairs = [];

  for (const textColor of candidates.text) {
    for (const backgroundColor of candidates.background) {
      const ratio = HexFetchUtils.contrastRatio(textColor.hex, backgroundColor.hex);
      if (typeof ratio !== "number") {
        continue;
      }

      pairs.push({
        textHex: textColor.hex,
        backgroundHex: backgroundColor.hex,
        ratio,
        rating: HexFetchUtils.wcagRating(ratio, { largeText: state.contrastLargeText })
      });
    }
  }

  pairs.sort((a, b) => b.ratio - a.ratio);

  return pairs;
}

function getFilteredContrastPairs(pairs) {
  if (!Array.isArray(pairs)) {
    return [];
  }

  return pairs.filter((pair) => {
    if (state.activeContrastFilter === "all") {
      return true;
    }

    if (state.activeContrastFilter === "pass") {
      return pair.rating.pass;
    }

    if (state.activeContrastFilter === "aaa") {
      return pair.rating.label === "AAA";
    }

    if (state.activeContrastFilter === "fail") {
      return !pair.rating.pass;
    }

    return true;
  });
}

function buildContrastReportMarkdown(palette) {
  const rows = getFilteredContrastPairs(getContrastPairs(palette)).slice(0, 24);
  if (!rows.length) {
    return "# HexFetch Contrast Report\n\nNo contrast pairs available for the current filter.";
  }

  const mode = state.contrastLargeText ? "Large Text" : "Normal Text";
  const filter = state.activeContrastFilter;
  const lines = [
    "# HexFetch Contrast Report",
    "",
    `- Mode: ${mode}`,
    `- Filter: ${filter}`,
    `- Generated: ${new Date().toISOString()}`,
    "",
    "| Text | Background | Ratio | WCAG |",
    "| --- | --- | ---: | --- |"
  ];

  for (const row of rows) {
    lines.push(`| ${row.textHex} | ${row.backgroundHex} | ${row.ratio.toFixed(2)}:1 | ${row.rating.label} |`);
  }

  return lines.join("\n");
}

function updateContrastControlUI() {
  for (const button of ui.contrastFilterButtons) {
    button.classList.toggle("active", button.dataset.contrastFilter === state.activeContrastFilter);
  }

  for (const button of ui.contrastSizeButtons) {
    const isLarge = button.dataset.contrastSize === "large";
    button.classList.toggle("active", state.contrastLargeText === isLarge);
  }
}

function renderSavedPalettes(items) {
  ui.savedPalettes.innerHTML = "";

  if (!items.length) {
    ui.savedPalettes.innerHTML = '<p class="swatch-count">No saved palettes yet.</p>';
    return;
  }

  for (const item of items) {
    const wrapper = document.createElement("article");
    wrapper.className = "saved-item";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const details = document.createElement("p");
    details.textContent = `${item.colors.length} colors • ${new Date(item.savedAt).toLocaleString()}`;

    const actions = document.createElement("div");
    actions.className = "saved-actions";

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.dataset.savedAction = "load";
    loadBtn.dataset.paletteId = item.id;
    loadBtn.textContent = "Load";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.dataset.savedAction = "copy";
    copyBtn.dataset.paletteId = item.id;
    copyBtn.textContent = "Copy";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.dataset.savedAction = "delete";
    deleteBtn.dataset.paletteId = item.id;
    deleteBtn.textContent = "Delete";

    actions.append(loadBtn, copyBtn, deleteBtn);

    wrapper.append(title, details, actions);
    ui.savedPalettes.appendChild(wrapper);
  }
}

async function loadSavedPalettes() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const items = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  state.savedPalettes = items;
  renderSavedPalettes(items);
  return items;
}

async function persistSavedPalettes(items) {
  state.savedPalettes = items;
  await chrome.storage.local.set({ [STORAGE_KEY]: items });
  renderSavedPalettes(items);
}

async function scanColors() {
  try {
    const response = await withReadyContentScript((tab) => sendTabMessage(tab.id, { type: "HEXFETCH_EXTRACT_COLORS" }));
    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Scan failed.");
    }

    state.palette = response.payload;
    renderPalette(response.payload.colors);
    renderGradients(response.payload.gradients);
    renderContrast(response.payload);
    setScanMeta(
      `${response.payload.colors.length} unique colors • ${response.payload.gradients.length} gradients • ${response.payload.scannedElements} elements`
    );
    setStatus(`Scanned ${response.payload.scannedElements} elements.`);
  } catch (error) {
    setStatus(error.message || "Unable to extract colors on this page.", true);
  }
}

async function toggleInspector() {
  try {
    const nextState = !state.inspectorEnabled;
    const response = await withReadyContentScript((tab) => {
      return sendTabMessage(tab.id, {
        type: "HEXFETCH_TOGGLE_INSPECTOR",
        enabled: nextState
      });
    });

    if (!response || !response.ok) {
      throw new Error(response && response.error ? response.error : "Inspector toggle failed.");
    }

    state.inspectorEnabled = response.payload.enabled;
    ui.toggleInspectorBtn.classList.toggle("active", state.inspectorEnabled);
    setStatus(state.inspectorEnabled ? "Inspector enabled." : "Inspector disabled.");
  } catch (error) {
    setStatus(error.message || "Unable to toggle inspector on this page.", true);
  }
}

async function copyAllColors() {
  if (!state.palette || !state.palette.colors.length) {
    setStatus("Scan colors before copying.", true);
    return;
  }

  const source = getFilteredColors(state.palette.colors, state.activeRoleFilter);
  const allColors = HexFetchUtils.dedupeHexList(source.map((entry) => entry.hex));
  await safeWriteClipboard(allColors.join("\n"));
  setStatus(`Copied ${allColors.length} colors.`);
}

async function exportCssVariables() {
  if (!state.palette || !state.palette.colors.length) {
    setStatus("Scan colors before exporting.", true);
    return;
  }

  const source = getFilteredColors(state.palette.colors, state.activeRoleFilter);
  const output = HexFetchUtils.buildCssVariables(source);
  await safeWriteClipboard(output);
  setStatus("CSS variables copied to clipboard.");
}

async function exportTailwindConfig() {
  if (!state.palette || !state.palette.colors.length) {
    setStatus("Scan colors before exporting.", true);
    return;
  }

  const source = getFilteredColors(state.palette.colors, state.activeRoleFilter);
  const output = HexFetchUtils.buildTailwindColors(source);
  await safeWriteClipboard(output);
  setStatus("Tailwind color config copied to clipboard.");
}

async function exportContrastReport() {
  if (!state.palette || !state.palette.colors.length) {
    setStatus("Scan colors before exporting contrast report.", true);
    return;
  }

  const markdown = buildContrastReportMarkdown(state.palette);
  await safeWriteClipboard(markdown);
  setStatus("Contrast report copied as markdown.");
}

function getPaletteHexList(palette) {
  if (!palette || !Array.isArray(palette.colors)) {
    return [];
  }

  return HexFetchUtils.dedupeHexList(palette.colors.map((entry) => entry.hex));
}

function loadSavedPalette(paletteId) {
  const selected = state.savedPalettes.find((item) => item.id === paletteId);
  if (!selected) {
    setStatus("Saved palette not found.", true);
    return;
  }

  state.palette = {
    colors: selected.colors,
    gradients: selected.gradients || [],
    scannedElements: 0,
    timestamp: selected.savedAt
  };

  renderPalette(state.palette.colors);
  renderGradients(state.palette.gradients);
  renderContrast(state.palette);
  setScanMeta(`${selected.colors.length} colors from saved palette`);
  setStatus(`Loaded ${selected.name}.`);
}

async function copySavedPalette(paletteId) {
  const selected = state.savedPalettes.find((item) => item.id === paletteId);
  if (!selected) {
    setStatus("Saved palette not found.", true);
    return;
  }

  await safeWriteClipboard(getPaletteHexList(selected).join("\n"));
  setStatus(`Copied ${selected.name}.`);
}

async function deleteSavedPalette(paletteId) {
  const nextItems = state.savedPalettes.filter((item) => item.id !== paletteId);
  await persistSavedPalettes(nextItems);
  setStatus("Saved palette deleted.");
}

async function savePalette() {
  if (!state.palette || !state.palette.colors.length) {
    setStatus("Scan colors before saving.", true);
    return;
  }

  const tab = state.activeTab || (await getActiveTab());
  const hostname = (() => {
    try {
      return new URL(tab.url).hostname;
    } catch {
      return "Palette";
    }
  })();

  const palette = {
    id: `${Date.now()}`,
    name: HexFetchUtils.formatPaletteName(hostname),
    hostname,
    savedAt: Date.now(),
    colors: state.palette.colors,
    gradients: state.palette.gradients
  };

  const updated = [palette, ...state.savedPalettes].slice(0, 20);
  await persistSavedPalettes(updated);
  setStatus(`Palette saved (${updated.length} total).`);
}

function normalizeImportedPalette(item) {
  if (!item || !Array.isArray(item.colors) || !item.colors.length) {
    return null;
  }

  return {
    id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: item.name || "Imported Palette",
    hostname: item.hostname || "imported.local",
    savedAt: Number(item.savedAt) || Date.now(),
    colors: item.colors,
    gradients: Array.isArray(item.gradients) ? item.gradients : []
  };
}

function downloadTextFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportSavedPalettesJson() {
  if (!state.savedPalettes.length) {
    setStatus("No saved palettes to export.", true);
    return;
  }

  const payload = {
    exportedAt: Date.now(),
    palettes: state.savedPalettes
  };

  const content = JSON.stringify(payload, null, 2);
  const filename = `hexfetch-palettes-${new Date().toISOString().slice(0, 10)}.json`;
  downloadTextFile(filename, content, "application/json");
  setStatus(`Exported ${state.savedPalettes.length} saved palettes.`);
}

async function importSavedPalettesJson(file) {
  if (!file) {
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error("JSON file is too large. Keep it under 2MB.");
  }

  const raw = await file.text();
  const parsed = JSON.parse(raw);
  const imported = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.palettes)
      ? parsed.palettes
      : [];

  const normalized = imported
    .map(normalizeImportedPalette)
    .filter(Boolean);

  if (!normalized.length) {
    throw new Error("No valid palettes found in JSON file.");
  }

  const existingById = new Map(state.savedPalettes.map((item) => [item.id, item]));
  for (const item of normalized) {
    existingById.set(item.id, item);
  }

  const merged = Array.from(existingById.values())
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(0, 50);

  await persistSavedPalettes(merged);
  setStatus(`Imported ${normalized.length} palettes.`);
}

async function hydrateFromLastQuickScan() {
  const result = await chrome.storage.local.get([LAST_SCAN_KEY]);
  const last = result[LAST_SCAN_KEY];
  if (!last || state.palette) {
    return;
  }

  state.palette = last;
  renderPalette(last.colors || []);
  renderGradients(last.gradients || []);
  renderContrast(last);
  const elementCount = typeof last.scannedElements === "number" ? last.scannedElements : 0;
  const colorCount = Array.isArray(last.colors) ? last.colors.length : 0;
  const gradientCount = Array.isArray(last.gradients) ? last.gradients.length : 0;
  setScanMeta(`${colorCount} unique colors • ${gradientCount} gradients • ${elementCount} elements`);
  setStatus("Loaded latest quick scan from keyboard command.");
}

async function hydrateInspectorState() {
  try {
    const response = await withReadyContentScript((tab) => sendTabMessage(tab.id, { type: "HEXFETCH_GET_INSPECTOR_STATE" }));
    if (!response || !response.ok || !response.payload) {
      return;
    }

    state.inspectorEnabled = Boolean(response.payload.enabled);
    ui.toggleInspectorBtn.classList.toggle("active", state.inspectorEnabled);
  } catch {
    state.inspectorEnabled = false;
    ui.toggleInspectorBtn.classList.remove("active");
  }
}

function wireEvents() {
  ui.scanColorsBtn.addEventListener("click", scanColors);
  ui.toggleInspectorBtn.addEventListener("click", toggleInspector);
  ui.copyAllBtn.addEventListener("click", () => copyAllColors().catch((err) => setStatus(err.message, true)));
  ui.exportCssBtn.addEventListener("click", () => exportCssVariables().catch((err) => setStatus(err.message, true)));
  ui.exportTailwindBtn.addEventListener("click", () => exportTailwindConfig().catch((err) => setStatus(err.message, true)));
  ui.exportContrastReportBtn.addEventListener("click", () => exportContrastReport().catch((err) => setStatus(err.message, true)));
  ui.savePaletteBtn.addEventListener("click", () => savePalette().catch((err) => setStatus(err.message, true)));
  ui.exportSavedJsonBtn.addEventListener("click", () => exportSavedPalettesJson().catch((err) => setStatus(err.message, true)));
  ui.importSavedJsonBtn.addEventListener("click", () => ui.importSavedJsonInput.click());
  ui.importSavedJsonInput.addEventListener("change", () => {
    const [file] = ui.importSavedJsonInput.files || [];
    importSavedPalettesJson(file)
      .catch((err) => setStatus(err.message, true))
      .finally(() => {
        ui.importSavedJsonInput.value = "";
      });
  });
  ui.saveSettingsBtn.addEventListener("click", () => saveSettings().catch((err) => setStatus(err.message, true)));

  for (const button of ui.roleFilterButtons) {
    button.addEventListener("click", () => {
      state.activeRoleFilter = button.dataset.roleFilter;
      updateRoleFilterUI();

      if (state.palette) {
        renderPalette(state.palette.colors);
      }

      setStatus(`Viewing ${state.activeRoleFilter} colors.`);
    });
  }

  ui.paletteSearchInput.addEventListener("input", () => {
    state.paletteSearchTerm = ui.paletteSearchInput.value || "";
    if (state.palette) {
      renderPalette(state.palette.colors);
    }
  });

  ui.paletteSortSelect.addEventListener("change", () => {
    state.paletteSortMode = ui.paletteSortSelect.value;
    if (state.palette) {
      renderPalette(state.palette.colors);
    }
    setStatus(`Sorted by ${state.paletteSortMode}.`);
  });

  for (const button of ui.contrastFilterButtons) {
    button.addEventListener("click", () => {
      state.activeContrastFilter = button.dataset.contrastFilter;
      updateContrastControlUI();
      renderContrast(state.palette);
      setStatus(`Contrast filter: ${state.activeContrastFilter}.`);
    });
  }

  for (const button of ui.contrastSizeButtons) {
    button.addEventListener("click", () => {
      state.contrastLargeText = button.dataset.contrastSize === "large";
      updateContrastControlUI();
      renderContrast(state.palette);
      setStatus(state.contrastLargeText ? "Using large-text WCAG thresholds." : "Using normal-text WCAG thresholds.");
    });
  }

  ui.savedPalettes.addEventListener("click", (event) => {
    const target = event.target.closest("[data-saved-action]");
    if (!target) {
      return;
    }

    const paletteId = target.dataset.paletteId;
    const action = target.dataset.savedAction;

    if (action === "load") {
      loadSavedPalette(paletteId);
      return;
    }

    if (action === "copy") {
      copySavedPalette(paletteId).catch((err) => setStatus(err.message, true));
      return;
    }

    if (action === "delete") {
      deleteSavedPalette(paletteId).catch((err) => setStatus(err.message, true));
    }
  });
}

async function init() {
  wireEvents();
  await loadSettings();
  updateRoleFilterUI();
  updateContrastControlUI();
  setScanMeta("No scan yet.");
  renderContrast(null);
  await getActiveTab();
  await loadSavedPalettes();
  await hydrateFromLastQuickScan();
  await hydrateInspectorState();
  if (!state.palette) {
    setStatus("Ready. Scan the current page.");
  }
}

init().catch((error) => setStatus(error.message || "Failed to initialize popup.", true));

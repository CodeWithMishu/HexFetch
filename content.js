(() => {
  const TRANSPARENT_VALUES = new Set([
    "transparent",
    "rgba(0, 0, 0, 0)",
    "rgba(0,0,0,0)",
    "hsla(0, 0%, 0%, 0)",
    "hsla(0,0%,0%,0)"
  ]);

  let inspectorEnabled = false;
  let inspectorLockedElement = null;
  let inspectorHoverElement = null;
  let overlayEl = null;
  let tooltipEl = null;
  let appliedPaletteStyleEl = null;

  function normalizeValue(value) {
    return (value || "").trim().toLowerCase();
  }

  function isTransparent(value) {
    const normalized = normalizeValue(value);
    return !normalized || TRANSPARENT_VALUES.has(normalized);
  }

  function clampChannel(channel) {
    if (Number.isNaN(channel)) {
      return 0;
    }
    return Math.max(0, Math.min(255, channel));
  }

  function toHexChannel(value) {
    return clampChannel(value).toString(16).padStart(2, "0");
  }

  function parseRgbChannel(value) {
    const raw = (value || "").trim();
    if (raw.endsWith("%")) {
      const percentage = Number.parseFloat(raw.slice(0, -1));
      if (Number.isNaN(percentage)) {
        return null;
      }
      return (Math.max(0, Math.min(100, percentage)) / 100) * 255;
    }

    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function parseAlpha(value) {
    if (typeof value !== "string") {
      return null;
    }

    const raw = value.trim();
    if (raw.endsWith("%")) {
      const percentage = Number.parseFloat(raw.slice(0, -1));
      if (Number.isNaN(percentage)) {
        return null;
      }
      return Math.max(0, Math.min(100, percentage)) / 100;
    }

    const alpha = Number.parseFloat(raw);
    return Number.isNaN(alpha) ? null : alpha;
  }

  function hslToRgb(h, s, l) {
    const saturation = Math.max(0, Math.min(100, s)) / 100;
    const lightness = Math.max(0, Math.min(100, l)) / 100;

    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const huePrime = ((h % 360) + 360) % 360 / 60;
    const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (huePrime >= 0 && huePrime < 1) {
      r1 = chroma;
      g1 = x;
    } else if (huePrime >= 1 && huePrime < 2) {
      r1 = x;
      g1 = chroma;
    } else if (huePrime >= 2 && huePrime < 3) {
      g1 = chroma;
      b1 = x;
    } else if (huePrime >= 3 && huePrime < 4) {
      g1 = x;
      b1 = chroma;
    } else if (huePrime >= 4 && huePrime < 5) {
      r1 = x;
      b1 = chroma;
    } else {
      r1 = chroma;
      b1 = x;
    }

    const m = lightness - chroma / 2;
    return {
      r: (r1 + m) * 255,
      g: (g1 + m) * 255,
      b: (b1 + m) * 255
    };
  }

  function hexToRgb(hex) {
    const normalized = normalizeValue(hex);
    if (!normalized.startsWith("#") || normalized.length !== 7) {
      return null;
    }

    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16)
    };
  }

  function classifyColorFamily(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return "unknown";
    }

    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    const lightness = (max + min) / 2;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

    if (saturation < 0.12) {
      if (lightness < 0.2) {
        return "neutral-dark";
      }
      if (lightness > 0.8) {
        return "neutral-light";
      }
      return "neutral";
    }

    let hue = 0;
    if (delta !== 0) {
      if (max === r) {
        hue = ((g - b) / delta) % 6;
      } else if (max === g) {
        hue = (b - r) / delta + 2;
      } else {
        hue = (r - g) / delta + 4;
      }
      hue = Math.round(hue * 60);
      if (hue < 0) {
        hue += 360;
      }
    }

    if (hue < 25 || hue >= 345) {
      return "red";
    }
    if (hue < 70) {
      return "orange-yellow";
    }
    if (hue < 165) {
      return "green";
    }
    if (hue < 255) {
      return "blue";
    }
    if (hue < 320) {
      return "purple";
    }
    return "pink";
  }

  function rgbOrRgbaToHex(color) {
    const normalized = normalizeValue(color);

    if (normalized.startsWith("#")) {
      if (normalized.length === 4) {
        const r = normalized[1];
        const g = normalized[2];
        const b = normalized[3];
        return `#${r}${r}${g}${g}${b}${b}`;
      }
      if (normalized.length === 7) {
        return normalized;
      }
      if (normalized.length === 9) {
        const alphaHex = normalized.slice(7, 9);
        const alpha = Number.parseInt(alphaHex, 16) / 255;
        if (alpha <= 0) {
          return null;
        }
        return normalized.slice(0, 7);
      }
      return null;
    }

    const rgbRegex = /rgba?\(([^)]+)\)/i;
    const match = normalized.match(rgbRegex);
    if (match) {
      const parts = match[1].split(",").map((part) => part.trim());
      if (parts.length < 3) {
        return null;
      }

      const red = parseRgbChannel(parts[0]);
      const green = parseRgbChannel(parts[1]);
      const blue = parseRgbChannel(parts[2]);

      if ([red, green, blue].some((num) => num === null)) {
        return null;
      }

      if (parts.length >= 4) {
        const alpha = parseAlpha(parts[3]);
        if (alpha !== null && alpha <= 0) {
          return null;
        }
      }

      return `#${toHexChannel(Math.round(red))}${toHexChannel(Math.round(green))}${toHexChannel(Math.round(blue))}`;
    }

    const hslRegex = /hsla?\(([^)]+)\)/i;
    const hslMatch = normalized.match(hslRegex);
    if (hslMatch) {
      const parts = hslMatch[1].split(",").map((part) => part.trim());
      if (parts.length < 3) {
        return null;
      }

      const hue = Number.parseFloat(parts[0]);
      const saturation = Number.parseFloat(parts[1].replace("%", ""));
      const lightness = Number.parseFloat(parts[2].replace("%", ""));

      if ([hue, saturation, lightness].some((num) => Number.isNaN(num))) {
        return null;
      }

      if (parts.length >= 4) {
        const alpha = parseAlpha(parts[3]);
        if (alpha !== null && alpha <= 0) {
          return null;
        }
      }

      const rgb = hslToRgb(hue, saturation, lightness);
      return `#${toHexChannel(Math.round(rgb.r))}${toHexChannel(Math.round(rgb.g))}${toHexChannel(Math.round(rgb.b))}`;
    }

    return null;
  }

  function getElementColorInfo(element) {
    const styles = window.getComputedStyle(element);
    return {
      text: rgbOrRgbaToHex(styles.getPropertyValue("color")),
      background: rgbOrRgbaToHex(styles.getPropertyValue("background-color")),
      border: rgbOrRgbaToHex(styles.getPropertyValue("border-color"))
    };
  }

  function extractGradientColors(styleValue) {
    const value = normalizeValue(styleValue);
    if (!value.includes("linear-gradient") && !value.includes("radial-gradient")) {
      return [];
    }

    const rgbMatches = value.match(/rgba?\([^)]+\)/g) || [];
    const hexMatches = value.match(/#[0-9a-f]{3,8}/gi) || [];
    const rawStops = [...rgbMatches, ...hexMatches];

    const uniqueStops = new Set();
    for (const stop of rawStops) {
      if (isTransparent(stop)) {
        continue;
      }
      const hex = rgbOrRgbaToHex(stop);
      if (hex) {
        uniqueStops.add(hex);
      }
    }

    return Array.from(uniqueStops);
  }

  function upsertColor(bucket, hex, role) {
    if (!bucket.has(hex)) {
      bucket.set(hex, {
        hex,
        count: 0,
        family: classifyColorFamily(hex),
        roles: {
          text: 0,
          background: 0,
          border: 0
        }
      });
    }

    const item = bucket.get(hex);
    item.count += 1;
    item.roles[role] += 1;
  }

  function collectElements(root) {
    if (!root) {
      return [];
    }

    if (root === document) {
      return Array.from(document.querySelectorAll("*"));
    }

    const descendants = root.querySelectorAll ? Array.from(root.querySelectorAll("*")) : [];
    return [root, ...descendants];
  }

  function extractPageColors(root = document) {
    const elements = collectElements(root);
    const colorMap = new Map();
    const gradientMap = new Map();

    for (const el of elements) {
      const styles = window.getComputedStyle(el);
      const textColor = styles.getPropertyValue("color");
      const backgroundColor = styles.getPropertyValue("background-color");
      const borderColor = styles.getPropertyValue("border-color");

      const colorEntries = [
        { value: textColor, role: "text" },
        { value: backgroundColor, role: "background" },
        { value: borderColor, role: "border" }
      ];

      for (const entry of colorEntries) {
        if (isTransparent(entry.value)) {
          continue;
        }

        const hex = rgbOrRgbaToHex(entry.value);
        if (!hex) {
          continue;
        }

        upsertColor(colorMap, hex, entry.role);
      }

      const gradientSources = [
        styles.getPropertyValue("background"),
        styles.getPropertyValue("background-image")
      ];

      for (const source of gradientSources) {
        const stops = extractGradientColors(source);
        if (!stops.length) {
          continue;
        }

        if (!gradientMap.has(source)) {
          gradientMap.set(source, new Set());
        }

        const stopSet = gradientMap.get(source);
        stops.forEach((stop) => stopSet.add(stop));
      }
    }

    const colors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

    const gradients = Array.from(gradientMap.entries()).map(([gradient, stops]) => ({
      gradient,
      stops: Array.from(stops)
    }));

    return {
      colors,
      gradients,
      grouped: {
        text: colors.filter((entry) => entry.roles.text > 0).map((entry) => entry.hex),
        background: colors.filter((entry) => entry.roles.background > 0).map((entry) => entry.hex)
      },
      scannedElements: elements.length,
      timestamp: Date.now()
    };
  }

  function buildAppliedPaletteCss(palette) {
    const colors = Array.isArray(palette && palette.colors) ? palette.colors : [];
    const lines = colors.slice(0, 24).map((entry, index) => `  --hexfetch-color-${index + 1}: ${entry.hex};`);
    return [
      ":root {",
      ...lines,
      "}",
      "html[data-hexfetch-applied='true'] {",
      "  outline: 2px solid rgba(76, 201, 240, 0.28);",
      "  outline-offset: -2px;",
      "}"
    ].join("\n");
  }

  function applyPaletteToPage(palette) {
    if (!palette || !Array.isArray(palette.colors) || !palette.colors.length) {
      throw new Error("No palette available to apply.");
    }

    if (!appliedPaletteStyleEl) {
      appliedPaletteStyleEl = document.createElement("style");
      appliedPaletteStyleEl.id = "hexfetch-applied-palette";
      document.documentElement.appendChild(appliedPaletteStyleEl);
    }

    appliedPaletteStyleEl.textContent = buildAppliedPaletteCss(palette);
    document.documentElement.dataset.hexfetchApplied = "true";

    return {
      applied: true,
      variables: Math.min(Array.isArray(palette.colors) ? palette.colors.length : 0, 24)
    };
  }

  function clearAppliedPalette() {
    if (appliedPaletteStyleEl && appliedPaletteStyleEl.parentNode) {
      appliedPaletteStyleEl.parentNode.removeChild(appliedPaletteStyleEl);
    }

    appliedPaletteStyleEl = null;
    delete document.documentElement.dataset.hexfetchApplied;

    return { applied: false };
  }

  function getTargetForExtraction(scope) {
    if (scope === "locked" && inspectorLockedElement) {
      return inspectorLockedElement;
    }

    return document;
  }

  function ensureInspectorUI() {
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = "hexfetch-inspector-overlay";
      overlayEl.style.position = "fixed";
      overlayEl.style.pointerEvents = "none";
      overlayEl.style.border = "1px solid #22d3ee";
      overlayEl.style.background = "rgba(34, 211, 238, 0.08)";
      overlayEl.style.zIndex = "2147483646";
      overlayEl.style.display = "none";
      document.documentElement.appendChild(overlayEl);
    }

    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.id = "hexfetch-inspector-tooltip";
      tooltipEl.style.position = "fixed";
      tooltipEl.style.pointerEvents = "none";
      tooltipEl.style.padding = "8px 10px";
      tooltipEl.style.border = "1px solid #263242";
      tooltipEl.style.borderRadius = "8px";
      tooltipEl.style.background = "#0c1118";
      tooltipEl.style.color = "#d7e0ea";
      tooltipEl.style.fontSize = "12px";
      tooltipEl.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace";
      tooltipEl.style.whiteSpace = "pre";
      tooltipEl.style.zIndex = "2147483647";
      tooltipEl.style.display = "none";
      document.documentElement.appendChild(tooltipEl);
    }
  }

  function hideInspectorUI() {
    if (overlayEl) {
      overlayEl.style.display = "none";
    }
    if (tooltipEl) {
      tooltipEl.style.display = "none";
    }
  }

  function renderInspectorTarget(target, clientX, clientY) {
    if (!target || target === overlayEl || target === tooltipEl) {
      return;
    }

    ensureInspectorUI();

    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      hideInspectorUI();
      return;
    }

    overlayEl.style.display = "block";
    overlayEl.style.left = `${rect.left}px`;
    overlayEl.style.top = `${rect.top}px`;
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;

    const info = getElementColorInfo(target);
    const lines = [
      `text: ${info.text || "n/a"}`,
      `bg: ${info.background || "n/a"}`,
      `border: ${info.border || "n/a"}`
    ];

    tooltipEl.textContent = lines.join("\n");
    tooltipEl.style.display = "block";

    const x = Math.min(window.innerWidth - 220, Math.max(8, clientX + 14));
    const y = Math.min(window.innerHeight - 70, Math.max(8, clientY + 14));

    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
  }

  function onInspectorMouseMove(event) {
    if (!inspectorEnabled) {
      return;
    }

    const activeTarget = inspectorLockedElement || event.target;
    inspectorHoverElement = event.target;
    renderInspectorTarget(activeTarget, event.clientX, event.clientY);
  }

  function onInspectorClick(event) {
    if (!inspectorEnabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (inspectorLockedElement) {
      inspectorLockedElement = null;
      renderInspectorTarget(event.target, event.clientX, event.clientY);
      return;
    }

    inspectorLockedElement = event.target;
    renderInspectorTarget(inspectorLockedElement, event.clientX, event.clientY);
  }

  function enableInspector() {
    if (inspectorEnabled) {
      return;
    }

    inspectorEnabled = true;
    ensureInspectorUI();
    document.addEventListener("mousemove", onInspectorMouseMove, true);
    document.addEventListener("click", onInspectorClick, true);
    document.body.style.cursor = "crosshair";
  }

  function disableInspector() {
    if (!inspectorEnabled) {
      return;
    }

    inspectorEnabled = false;
    inspectorLockedElement = null;
    inspectorHoverElement = null;
    document.removeEventListener("mousemove", onInspectorMouseMove, true);
    document.removeEventListener("click", onInspectorClick, true);
    document.body.style.cursor = "";
    hideInspectorUI();
  }

  function toggleInspector(enabled) {
    if (enabled) {
      enableInspector();
    } else {
      disableInspector();
    }

    return { enabled: inspectorEnabled };
  }

  function getInspectorState() {
    return {
      enabled: inspectorEnabled,
      locked: Boolean(inspectorLockedElement),
      hovering: Boolean(inspectorHoverElement)
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    try {
      if (message.type === "HEXFETCH_EXTRACT_COLORS") {
        const payload = extractPageColors();
        sendResponse({ ok: true, payload });
      }

      if (message.type === "HEXFETCH_EXTRACT_TARGET_COLORS") {
        const target = getTargetForExtraction(message.scope);

        if (message.scope === "locked" && !inspectorLockedElement) {
          sendResponse({ ok: false, error: "Lock a target element with the inspector before scanning a selection." });
          return;
        }

        const payload = extractPageColors(target);
        sendResponse({ ok: true, payload });
      }

      if (message.type === "HEXFETCH_APPLY_PALETTE") {
        const payload = applyPaletteToPage(message.palette);
        sendResponse({ ok: true, payload });
      }

      if (message.type === "HEXFETCH_CLEAR_APPLIED_PALETTE") {
        const payload = clearAppliedPalette();
        sendResponse({ ok: true, payload });
      }

      if (message.type === "HEXFETCH_TOGGLE_INSPECTOR") {
        const payload = toggleInspector(Boolean(message.enabled));
        sendResponse({ ok: true, payload });
      }

      if (message.type === "HEXFETCH_GET_INSPECTOR_STATE") {
        sendResponse({ ok: true, payload: getInspectorState() });
      }

      if (message.type === "HEXFETCH_PING") {
        sendResponse({ ok: true, payload: { alive: true } });
      }
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown extraction error"
      });
    }

    return true;
  });
})();

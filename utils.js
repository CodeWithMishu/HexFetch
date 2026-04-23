(() => {
  function toTitleCase(value) {
    return (value || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function safeName(value, fallback) {
    const cleaned = (value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return cleaned || fallback;
  }

  function buildCssVariables(colors) {
    const lines = colors.map((entry, index) => `  --color-${index + 1}: ${entry.hex};`);
    return [":root {", ...lines, "}"].join("\n");
  }

  function buildTailwindColors(colors) {
    const keys = ["primary", "secondary", "accent", "muted", "neutral"];
    const lines = colors.map((entry, index) => {
      const fallbackKey = `color${index + 1}`;
      const key = keys[index] || fallbackKey;
      return `    ${key}: \"${entry.hex}\"`;
    });

    return ["colors: {", `${lines.join(",\n")}`, "  }"]
      .join("\n")
      .replace(/^colors:\s\{\n/, "colors: {\n");
  }

  function dedupeHexList(hexList) {
    return Array.from(new Set((hexList || []).filter(Boolean).map((hex) => hex.toLowerCase())));
  }

  function hexToRgb(hex) {
    if (!hex || typeof hex !== "string") {
      return null;
    }

    const normalized = hex.trim().toLowerCase();
    if (!normalized.startsWith("#")) {
      return null;
    }

    if (normalized.length === 4) {
      return {
        r: Number.parseInt(`${normalized[1]}${normalized[1]}`, 16),
        g: Number.parseInt(`${normalized[2]}${normalized[2]}`, 16),
        b: Number.parseInt(`${normalized[3]}${normalized[3]}`, 16)
      };
    }

    if (normalized.length === 7) {
      return {
        r: Number.parseInt(normalized.slice(1, 3), 16),
        g: Number.parseInt(normalized.slice(3, 5), 16),
        b: Number.parseInt(normalized.slice(5, 7), 16)
      };
    }

    return null;
  }

  function toLinear(channel) {
    const c = channel / 255;
    if (c <= 0.03928) {
      return c / 12.92;
    }
    return ((c + 0.055) / 1.055) ** 2.4;
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) {
      return null;
    }

    const r = toLinear(rgb.r);
    const g = toLinear(rgb.g);
    const b = toLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(textHex, bgHex) {
    const textLum = relativeLuminance(textHex);
    const bgLum = relativeLuminance(bgHex);
    if (textLum === null || bgLum === null) {
      return null;
    }

    const lighter = Math.max(textLum, bgLum);
    const darker = Math.min(textLum, bgLum);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function wcagRating(ratio, options = {}) {
    if (typeof ratio !== "number") {
      return { label: "N/A", pass: false };
    }

    const largeText = Boolean(options.largeText);
    const aaThreshold = largeText ? 3 : 4.5;
    const aaaThreshold = largeText ? 4.5 : 7;

    if (ratio >= aaaThreshold) {
      return { label: "AAA", pass: true };
    }

    if (ratio >= aaThreshold) {
      return { label: "AA", pass: true };
    }

    return { label: "Fail", pass: false };
  }

  function formatPaletteName(hostname) {
    const date = new Date();
    const shortDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return `${toTitleCase(hostname)} ${shortDate}`.trim();
  }

  window.HexFetchUtils = {
    buildCssVariables,
    buildTailwindColors,
    contrastRatio,
    dedupeHexList,
    formatPaletteName,
    hexToRgb,
    relativeLuminance,
    safeName,
    wcagRating
  };
})();

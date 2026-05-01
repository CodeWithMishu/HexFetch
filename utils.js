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

  function buildScssVariables(colors) {
    const lines = colors.map((entry, index) => `$color-${index + 1}: ${entry.hex};`);
    return lines.join("\n");
  }

  function buildLessVariables(colors) {
    const lines = colors.map((entry, index) => `@color-${index + 1}: ${entry.hex};`);
    return lines.join("\n");
  }

  function buildTailwindColors(colors) {
    const keys = ["primary", "secondary", "accent", "muted", "neutral"];
    const lines = colors.map((entry, index) => {
      const fallbackKey = `color${index + 1}`;
      const key = keys[index] || fallbackKey;
      return `      ${key}: \"${entry.hex}\"`;
    });

    return [
      "module.exports = {",
      "  theme: {",
      "    extend: {",
      "      colors: {",
      ...lines.map((line, index) => `${line}${index === lines.length - 1 ? "" : ","}`),
      "      }",
      "    }",
      "  }",
      "};"
    ].join("\n");
  }

  function buildDesignTokensJson(colors) {
    const tokens = {};

    colors.forEach((entry, index) => {
      const key = `color-${index + 1}`;
      tokens[key] = {
        value: entry.hex,
        type: "color"
      };
    });

    return JSON.stringify(
      {
        "$schema": "https://design-tokens.github.io/community-group/format/",
        colors: tokens
      },
      null,
      2
    );
  }

  function getPaletteFamilies(colors) {
    const counts = new Map();

    for (const entry of colors || []) {
      const family = entry && entry.family ? entry.family : "unknown";
      const current = counts.get(family) || 0;
      counts.set(family, current + (entry && typeof entry.count === "number" ? entry.count : 1));
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([family, count]) => ({ family, count }));
  }

  function buildPaletteTags(colors) {
    const families = getPaletteFamilies(colors)
      .filter((entry) => entry.family && entry.family !== "unknown")
      .slice(0, 4)
      .map((entry) => `family:${entry.family}`);

    const roles = [];
    const safeColors = Array.isArray(colors) ? colors : [];
    const roleNames = ["text", "background", "border"];

    for (const role of roleNames) {
      const roleCount = safeColors.reduce((sum, entry) => sum + ((entry.roles && entry.roles[role]) || 0), 0);
      if (roleCount > 0) {
        roles.push(`role:${role}`);
      }
    }

    return Array.from(new Set([...families, ...roles])).slice(0, 6);
  }

  function buildPaletteSummary(colors) {
    const families = getPaletteFamilies(colors);
    return families.length ? families.map((entry) => `${entry.family} ${entry.count}`).join(", ") : "No color families detected";
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
    buildDesignTokensJson,
    buildLessVariables,
    buildPaletteTags,
    buildPaletteSummary,
    buildScssVariables,
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

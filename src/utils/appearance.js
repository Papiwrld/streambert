// ── Accent colour presets & helpers ──────────────────────────────────────────
// Kept in a separate file so both App.jsx and SettingsPage.jsx can import
// without creating a circular dependency.

export const ACCENT_PRESETS = [
  {
    id: "red",
    label: "Red",
    color: "#e5232b",
    color2: "#f0353d",
    dim: "rgba(229,35,43,0.14)",
    glow: "none",
  },
  {
    id: "blue",
    label: "Blue",
    color: "#2563eb",
    color2: "#3b82f6",
    dim: "rgba(37,99,235,0.15)",
    glow: "none",
  },
  {
    id: "purple",
    label: "Purple",
    color: "#7c3aed",
    color2: "#8b5cf6",
    dim: "rgba(124,58,237,0.15)",
    glow: "none",
  },
  {
    id: "green",
    label: "Green",
    color: "#059669",
    color2: "#10b981",
    dim: "rgba(5,150,105,0.15)",
    glow: "none",
  },
  {
    id: "orange",
    label: "Orange",
    color: "#d97706",
    color2: "#f59e0b",
    dim: "rgba(217,119,6,0.15)",
    glow: "none",
  },
  {
    id: "pink",
    label: "Pink",
    color: "#db2777",
    color2: "#ec4899",
    dim: "rgba(219,39,119,0.15)",
    glow: "none",
  },
];

function accentLuminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((pair) => {
    const channel = parseInt(pair, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function applyAccentColor(presetId) {
  const preset =
    ACCENT_PRESETS.find((p) => p.id === presetId) ?? ACCENT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--red", preset.color);
  root.style.setProperty("--red2", preset.color2);
  root.style.setProperty("--red-dim", preset.dim);
  root.style.setProperty("--red-glow", preset.glow);
  const whiteText = 1.05 / (accentLuminance(preset.color) + 0.05) >= 4.5;
  const hoverColor = whiteText && 1.05 / (accentLuminance(preset.color2) + 0.05) < 4.5
    ? `color-mix(in srgb, ${preset.color} 90%, black)`
    : preset.color2;
  root.style.setProperty("--on-accent", whiteText ? "#fff" : "#000");
  root.style.setProperty("--accent-button-hover", hoverColor);
}

// ── Theme presets ─────────────────────────────────────────────────────────────

/**
 * Each theme defines the background/surface/text CSS variables.
 * The accent colour (--red / --red2 / ...) is applied via applyAccentColor.
 */
export const THEME_PRESETS = [
  {
    id: "dark",
    label: "Dark",
    description: "Default dark theme",
    vars: {
      "--bg": "#0e0e10",
      "--surface": "#141416",
      "--surface2": "#1b1b1e",
      "--surface3": "#232327",
      "--border": "#2a2a2e",
      "--hairline": "rgba(255, 255, 255, 0.07)",
      "--text": "#f2f2f3",
      "--text2": "#b4b4ba",
      "--text3": "#85858c",
    },
  },
  {
    id: "amoled",
    label: "AMOLED",
    description: "True black for OLED displays",
    vars: {
      "--bg": "#000000",
      "--surface": "#080808",
      "--surface2": "#111111",
      "--surface3": "#181818",
      "--border": "#1f1f1f",
      "--hairline": "rgba(255, 255, 255, 0.07)",
      "--text": "#ffffff",
      "--text2": "#cccccc",
      "--text3": "#888888",
    },
  },
  {
    id: "mocha",
    label: "Mocha",
    description: "Warm dark brown tones",
    vars: {
      "--bg": "#0e0b09",
      "--surface": "#1a1410",
      "--surface2": "#231c16",
      "--surface3": "#2e251d",
      "--border": "#3a2e24",
      "--hairline": "rgba(255, 255, 255, 0.07)",
      "--text": "#f0e8df",
      "--text2": "#c4b09a",
      "--text3": "#8a7060",
    },
  },
  {
    id: "slate",
    label: "Slate",
    description: "Cool blue-grey tones",
    vars: {
      "--bg": "#0d1117",
      "--surface": "#161b22",
      "--surface2": "#1f2937",
      "--surface3": "#273344",
      "--border": "#30363d",
      "--hairline": "rgba(255, 255, 255, 0.07)",
      "--text": "#e6edf3",
      "--text2": "#8b949e",
      "--text3": "#6e7681",
    },
  },
  {
    id: "light",
    label: "Light",
    description: "Light surfaces with dark text",
    vars: {
      "--bg": "#ebebed",
      "--surface": "#f8f8fa",
      "--surface2": "#eeeef0",
      "--surface3": "#e2e2e5",
      "--border": "#c8c8cc",
      "--hairline": "rgba(0, 0, 0, 0.09)",
      "--text": "#111113",
      "--text2": "#3a3a40",
      "--text3": "#6b6b74",
    },
  },
  {
    id: "custom",
    label: "Custom",
    description: "Your own colours",
    vars: null,
  },
];

/** Default custom theme vars (used when user first opens the custom editor). */
export const DEFAULT_CUSTOM_VARS = {
  "--bg": "#0e0e10",
  "--surface": "#141416",
  "--surface2": "#1b1b1e",
  "--surface3": "#232327",
  "--border": "#2a2a2e",
  "--text": "#f2f2f3",
  "--text2": "#b4b4ba",
  "--text3": "#85858c",
};

function isLightHex(hex) {
  if (typeof hex !== "string") return false;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

/**
 * Apply a theme by id.
 * @param {string} themeId  - id from THEME_PRESETS
 * @param {object|null} customVars - only used when themeId === "custom"
 */
export function applyTheme(themeId, customVars = null) {
  const preset =
    THEME_PRESETS.find((t) => t.id === themeId) ?? THEME_PRESETS[0];
  const vars =
    themeId === "custom" ? (customVars ?? DEFAULT_CUSTOM_VARS) : preset.vars;
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
  if (themeId === "custom") {
    root.style.setProperty(
      "--hairline",
      isLightHex(vars["--bg"])
        ? "rgba(0, 0, 0, 0.09)"
        : "rgba(255, 255, 255, 0.07)",
    );
  }
}

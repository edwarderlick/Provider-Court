import type { Config } from "tailwindcss";

// Lifted verbatim from the Stitch `code.html` exports (all 19 screens share
// the same color palette). borderRadius is normalized to the brutalist
// "sharp corners" convention used by the majority of screens — a few exports
// (landing_page_mobile, delivery_verdict_mobile, my_jobs_buyer_dashboard)
// shipped rounded corners; that was a Stitch inconsistency, not intentional.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-secondary-container": "#376c58",
        "tertiary-fixed": "#d4e3ff",
        outline: "#916f65",
        "surface-tint": "#ad3300",
        "on-tertiary-fixed-variant": "#004884",
        "on-surface": "#281712",
        "tertiary-fixed-dim": "#a4c9ff",
        "secondary-fixed": "#b6efd5",
        "surface-container-low": "#fff1ed",
        "on-primary-container": "#fffbff",
        "on-secondary-fixed": "#002116",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        tertiary: "#005da8",
        "surface-dim": "#f2d3ca",
        "surface-container": "#ffe9e3",
        secondary: "#326854",
        "surface-variant": "#fbdcd3",
        "surface-bright": "#fff8f6",
        "secondary-fixed-dim": "#9ad2b9",
        "on-primary": "#ffffff",
        "on-tertiary": "#ffffff",
        "on-secondary": "#ffffff",
        "inverse-surface": "#3f2c26",
        surface: "#fff8f6",
        "tertiary-container": "#0076d3",
        primary: "#a93100",
        "on-error-container": "#93000a",
        "on-tertiary-container": "#fdfcff",
        "surface-container-high": "#ffe2da",
        "surface-container-lowest": "#ffffff",
        "on-tertiary-fixed": "#001c39",
        "on-primary-fixed": "#3a0b00",
        "inverse-primary": "#ffb59e",
        "on-background": "#281712",
        "on-secondary-fixed-variant": "#17503d",
        "outline-variant": "#e6beb2",
        "surface-container-highest": "#fbdcd3",
        "secondary-container": "#b3ecd2",
        "on-primary-fixed-variant": "#842500",
        "primary-container": "#d34000",
        "primary-fixed": "#ffdbd0",
        "on-error": "#ffffff",
        "on-surface-variant": "#5c4037",
        "primary-fixed-dim": "#ffb59e",
        background: "#fff8f6",
        "inverse-on-surface": "#ffede8",
        // Extra token used only by delivery_verdict / delivery_verdict_animated
        "deep-green": "#00402e",
      },
      borderRadius: {
        DEFAULT: "0px",
        lg: "0px",
        xl: "0px",
        full: "9999px",
      },
      spacing: {
        unit: "4px",
        "margin-mobile": "16px",
        gutter: "16px",
        "margin-desktop": "40px",
        "technical-gap": "8px",
      },
      fontFamily: {
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "mono-label": ['"JetBrains Mono"', "monospace"],
        "display-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "mono-data": ['"JetBrains Mono"', "monospace"],
      },
      fontSize: {
        "headline-lg-mobile": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.5", fontWeight: "400" }],
        "headline-lg": [
          "48px",
          { lineHeight: "1.1", letterSpacing: "0.05em", fontWeight: "600" },
        ],
        "mono-label": [
          "14px",
          { lineHeight: "1.2", letterSpacing: "0.05em", fontWeight: "500" },
        ],
        "display-lg": [
          "80px",
          { lineHeight: "1.0", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "headline-md": [
          "32px",
          { lineHeight: "1.2", letterSpacing: "0.02em", fontWeight: "600" },
        ],
        "mono-data": ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "led-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        scan: {
          "0%": { top: "0%" },
          "100%": { top: "100%" },
        },
      },
      animation: {
        blink: "blink 2s infinite",
        "led-pulse": "led-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        scan: "scan 4s linear infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};

export default config;

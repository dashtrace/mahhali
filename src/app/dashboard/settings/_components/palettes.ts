import type { Theme } from "@/server/domain/theme";

/** Full colour sets for the Brand colours tab. Radius and font stay as the owner set them. */
export const STORE_PALETTES = {
  rosewood: { primary: "#874258", accent: "#b99b7b", background: "#faf5f1", surface: "#f1e8e1", text: "#30282b", muted: "#756b68", dark: "#714558", darkText: "#fffaf5", border: "#e4d7d1", buttonText: "#ffffff" },
  blush: { primary: "#9e5268", accent: "#caa99d", background: "#fff9f7", surface: "#f4e5e4", text: "#342930", muted: "#7f6f72", dark: "#7b4457", darkText: "#fffaf7", border: "#e9d5d7", buttonText: "#fffdfc" },
  olive: { primary: "#526c48", accent: "#c8af7b", background: "#f7f5ea", surface: "#ebeadd", text: "#243b30", muted: "#6b7165", dark: "#26473c", darkText: "#fff9e5", border: "#d9decf", buttonText: "#fffef6" },
  terracotta: { primary: "#ac583d", accent: "#d7a675", background: "#fff9f1", surface: "#f5e6d9", text: "#4b332c", muted: "#7e6f67", dark: "#844333", darkText: "#fff7e7", border: "#e9d6c8", buttonText: "#ffffff" },
  midnight: { primary: "#8e673a", accent: "#d9bd7b", background: "#f7f4ef", surface: "#eae3dc", text: "#202631", muted: "#6c6f73", dark: "#202631", darkText: "#fff1d7", border: "#d9d5d0", buttonText: "#ffffff" },
} as const satisfies Record<string, Omit<Theme, "radius" | "font">>;

export type StorePaletteName = keyof typeof STORE_PALETTES;

/** The Brand colours grid, in the demo's order. All but the first three can be left Automatic. */
export const COLOUR_ROLES = ["primary", "accent", "background", "surface", "text", "muted", "dark", "darkText", "border", "buttonText"] as const;
export const REQUIRED_ROLES: readonly string[] = ["primary", "accent", "background"];

/** validateTheme's pair names to their messages, for the contrast feedback. */
export const PAIR_MESSAGES = {
  "text on primary": "pairPrimary",
  "body text on background": "pairBackground",
  "links on background": "pairLinks",
  "muted text on background": "pairMuted",
  "body text on surface": "pairSurface",
  "text on dark band": "pairBand",
} as const;

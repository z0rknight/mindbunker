import { Inter, Press_Start_2P } from "next/font/google";

// RMEDIA OS design-system bridge (Wave 1, Session Timeline only). Scoped
// entirely to this feature's own new components -- next/font/google
// self-hosts at build time (zero extra npm dependency, no runtime request
// to Google), so this is safe to add without touching the app-wide font
// stack in layout.tsx/globals.css. Press Start 2P is used ONLY for small
// HUD-shaped labels (view-switcher tabs, tiny status/period labels) --
// never for dense session content, which stays in Inter for readability.
export const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const denseFont = Inter({
  subsets: ["latin"],
  display: "swap",
});

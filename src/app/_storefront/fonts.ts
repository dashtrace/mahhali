import { DM_Sans, Playfair_Display } from "next/font/google";

// Applied on ShopFrame, not the root layout, so the dashboard never loads them.
export const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

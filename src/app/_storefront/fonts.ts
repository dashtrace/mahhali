import { Playfair_Display } from "next/font/google";

// Applied on ShopFrame, not the root layout, so the dashboard never loads it.
export const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

import type { Metadata, Viewport } from "next";
import { Cairo, Inter, Tajawal } from "next/font/google";
import { dirOf } from "@/i18n/locale";
import { getLocale } from "@/i18n/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
// Offered to shops in the branding settings.
const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Mahhali", template: "%s · Mahhali" },
  description: "Orders, stock and cash on delivery for Instagram and WhatsApp shops.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)} className={`${inter.variable} ${cairo.variable} ${tajawal.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

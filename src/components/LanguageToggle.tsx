"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/locale";
import { cx } from "./ui";

/** Switches the interface language; kept for a year in the "lang" cookie. */
export function LanguageToggle({ locale, className }: { locale: Locale; className?: string }) {
  const router = useRouter();
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      onClick={() => {
        document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className={cx("inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-fg hover:bg-sl-cat", className)}
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}

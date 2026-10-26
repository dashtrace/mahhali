export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Each area keeps its strings in one file; Arabic must have every English key. */
export function defineMessages<T extends Record<string, string>>(m: { en: T; ar: { [K in keyof T]: string } }) {
  return m as { en: T; ar: T };
}

/** "{n} orders" + { n: 3 } -> "3 orders". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

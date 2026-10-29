import { cookies } from "next/headers";
import { isLocale, type Locale } from "./locale";

/** The dashboard language: the visitor's choice, kept in the "lang" cookie. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("lang")?.value;
  return isLocale(value) ? value : "en";
}

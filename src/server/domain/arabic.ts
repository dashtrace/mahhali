// Search that matches the way people actually type Arabic: with or without
// hamza and diacritics, ة or ه, ى or ي, and Arabic-Indic digits.

const ARABIC_MARKS = /[ً-ٰٟـ]/g; // tashkeel, superscript alef, tatweel
const LATIN_MARKS = /[̀-ͯ]/g;
const LETTERS: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ة": "ه",
  "ى": "ي", "ئ": "ي",
  "ؤ": "و",
};
const DIGITS: Record<string, string> = Object.fromEntries(
  [..."٠١٢٣٤٥٦٧٨٩", ..."۰۱۲۳۴۵۶۷۸۹"].map((d, i) => [d, String(i % 10)]),
);

/** "عِطْرٌ" -> "عطر", "مَدْرَسَة" -> "مدرسه", "Café" -> "cafe". */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(LATIN_MARKS, "")
    .normalize("NFC")
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱةىئؤ]/g, (c) => LETTERS[c])
    .replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d])
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every word of the query appears somewhere in the text. */
export function matchesSearch(text: string, query: string): boolean {
  const haystack = normalizeSearch(text);
  return normalizeSearch(query)
    .split(" ")
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

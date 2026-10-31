// Catches typos in the domains of the big mail providers ("fatima@gmail.cam"),
// which are valid addresses on paper but never arrive. Pure: used by the API
// schemas and by forms to suggest the fix.

/** Providers that only exist at one domain: any other ending is a typo. */
const SINGLE: Record<string, string> = { gmail: "gmail.com", googlemail: "googlemail.com", icloud: "icloud.com" };
/** Providers with real country domains (hotmail.fr, yahoo.co.uk): only obvious ending typos count. */
const MULTI = new Set(["hotmail", "outlook", "yahoo", "live"]);
/** Endings that are slips of ".com" (".cam" is a real TLD, but not for these providers). */
const TYPO_ENDINGS = new Set(["cam", "con", "cmo", "comm", "cpm", "xom", "vom", "ocm", "coom", "co", "cm"]);
// shortcut: a fixed list of common slips, not an edit distance (that would flag real mail.com, email.com, ymail.com); extend it as typos show up.
const MISSPELT: Record<string, string> = {
  gmial: "gmail", gmal: "gmail", gmai: "gmail", gamil: "gmail", gnail: "gmail", gmali: "gmail", gmaill: "gmail", gmil: "gmail", gmaul: "gmail",
  hotmial: "hotmail", hotmal: "hotmail", hotmai: "hotmail", hotamil: "hotmail", homail: "hotmail", hotmali: "hotmail", hormail: "hotmail", hotmaill: "hotmail",
  yaho: "yahoo", yahooo: "yahoo", yhoo: "yahoo", yaoo: "yahoo", yahho: "yahoo",
  outlok: "outlook", outllok: "outlook", oulook: "outlook", otlook: "outlook", outlook0: "outlook",
  iclod: "icloud", icoud: "icloud", icluod: "icloud", iclould: "icloud",
};

/** The corrected address when the domain looks like a slip of a big provider's, else null. */
export function emailTypo(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  const dot = domain.indexOf(".");
  if (dot < 1) return null;
  const label = domain.slice(0, dot);
  const ending = domain.slice(dot + 1);
  const provider = MISSPELT[label] ?? label;

  let fixed: string | null = null;
  if (SINGLE[provider]) fixed = SINGLE[provider];
  else if (MULTI.has(provider)) fixed = `${provider}.${TYPO_ENDINGS.has(ending) ? "com" : ending}`;
  return fixed && fixed !== domain ? `${email.slice(0, at)}@${fixed}` : null;
}

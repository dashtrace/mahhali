// What AI assistants (MCP tools) see of a customer: enough to recognise the
// order, never enough to contact the customer. The dashboard is unaffected.
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { reviewAuthorName } from "./names";

const DOT = "•";

/** "Maya Al Haddad" -> "Maya H."; Arabic names work the same way. */
export function maskName(fullName: string): string {
  return reviewAuthorName(fullName);
}

/** "+96171234523" -> "+961 7•••••23": the country code, the first digit and the last two. */
export function maskPhone(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone);
  if (parsed) {
    const national = parsed.nationalNumber;
    if (national.length > 3) {
      return `+${parsed.countryCallingCode} ${national[0]}${DOT.repeat(national.length - 3)}${national.slice(-2)}`;
    }
  }
  const digits = phone.replace(/\D/g, "");
  return digits.length > 2 ? `${DOT.repeat(digits.length - 2)}${digits.slice(-2)}` : DOT.repeat(digits.length);
}

type Address = { governorate: string; district: string; area: string };

/** Down to the area: the street, building and landmark are left out. */
export function maskAddress<A extends Address>(address: A): Address {
  return { governorate: address.governorate, district: address.district, area: address.area };
}

// Western (0-9), Arabic-Indic (٠-٩) and Persian (۰-۹) digits.
const D = "[0-9٠-٩۰-۹]";
// Seven or more digits, optionally led by + and split by spaces, dots, dashes or brackets.
const PHONE_LIKE = new RegExp(`\\+?${D}(?:[\\s.\\-()]*${D}){6,}`, "g");
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

/** Free text a customer typed (order notes): hides anything that looks like a phone number or email. */
export function maskText(text: string): string {
  return text.replace(EMAIL_LIKE, "[email hidden]").replace(PHONE_LIKE, "[phone hidden]");
}

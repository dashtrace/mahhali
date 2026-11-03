// What makes a new password too weak. Pure: the API schemas refuse it and the
// sign-up forms explain it while the person types.

// shortcut: a short list of the most guessed passwords; check a breached-password list if accounts get targeted.
const COMMON = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000", "12341234", "11223344",
  "password", "password1", "password123", "passw0rd", "qwertyui", "qwerty123", "qwertyuiop", "azertyui",
  "abcd1234", "abc12345", "iloveyou", "admin123", "welcome1", "letmein1", "lebanon1", "beirut123",
]);

export type PasswordProblem = "Short" | "Common" | "NoLetter" | "NoDigitOrSymbol";

/** Why a new password is too weak, or null: 8+ characters, a letter (any script), a digit or symbol, not a common one. */
export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < 8) return "Short";
  if (COMMON.has(password.toLowerCase())) return "Common";
  if (!/\p{L}/u.test(password)) return "NoLetter";
  if (!/\P{L}/u.test(password)) return "NoDigitOrSymbol";
  return null;
}

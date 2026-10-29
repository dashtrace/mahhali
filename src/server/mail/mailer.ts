// Transactional email behind one small interface. Resend in production; in
// tests and local development the mail is kept in `outbox` (and logged in dev).
export type Mail = { to: string; subject: string; text: string; html?: string };

export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    outbox.push(mail);
    if (process.env.NODE_ENV === "development") console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Mahhali <orders@mahhali.app>", ...mail }),
  });
  if (!res.ok) throw new Error(`Email provider refused the message: ${res.status} ${await res.text()}`);
}

/** The public base URL used in links inside emails. */
export function appUrl(path: string): string {
  return new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}

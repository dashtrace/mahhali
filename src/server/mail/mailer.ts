// Transactional email behind one small interface. Brevo's HTTP API in production
// (Railway blocks outgoing SMTP); in tests and local development the mail is kept
// in `outbox` (and logged in dev).
export type Mail = { to: string; subject: string; text: string; html?: string };

export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    outbox.push(mail);
    if (process.env.NODE_ENV === "development") console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseSender(process.env.MAIL_FROM ?? ""),
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
      htmlContent: mail.html,
    }),
  });
  if (!res.ok) throw new Error(`Email provider refused the message: ${res.status} ${await res.text()}`);
}

/** "StoreLift <shop@gmail.com>" or "shop@gmail.com" → Brevo's sender object. */
export function parseSender(from: string): { name?: string; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() };
}

/** The public base URL used in links inside emails. */
export function appUrl(path: string): string {
  return new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}

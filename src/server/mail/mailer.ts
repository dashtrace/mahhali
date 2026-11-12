import nodemailer from "nodemailer";

// Transactional email behind one small interface. Gmail SMTP in production; in
// tests and local development the mail is kept in `outbox` (and logged in dev).
export type Mail = { to: string; subject: string; text: string; html?: string };

export const outbox: Mail[] = [];

export async function sendMail(mail: Mail): Promise<void> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    outbox.push(mail);
    if (process.env.NODE_ENV === "development") console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user, pass },
  });
  await transport.sendMail({ from: process.env.MAIL_FROM ?? `StoreLift <${user}>`, ...mail });
}

/** The public base URL used in links inside emails. */
export function appUrl(path: string): string {
  return new URL(path, process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();
}

"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/PasswordField";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import type { authMessages } from "@/i18n/messages/auth";
import { authClient, followOAuthRedirect } from "@/lib/authClient";

export function LoginForm({ m, next, locale }: { m: (typeof authMessages)["en"]; next: string; locale: Locale }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // onSubmit, not a form action: React resets a form after its action runs, wiping what was typed.
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(m.badCredentials);
      setPending(false);
      return;
    }
    // Signing in while connecting an AI assistant: the OAuth flow carries on.
    if (followOAuthRedirect(data)) return;
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={m.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required dir="ltr" />
      </Field>
      <PasswordField label={m.password} locale={locale} />
      <Button type="submit" disabled={pending} block className="mt-1 min-h-12 text-[15px]">
        {pending ? m.signingIn : m.signInButton}
      </Button>
    </form>
  );
}

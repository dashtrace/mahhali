"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { authMessages } from "@/i18n/messages/auth";
import { authClient } from "@/lib/authClient";

export function LoginForm({ m, next }: { m: (typeof authMessages)["en"]; next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(m.badCredentials);
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={m.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label={m.password}>
        <Input name="password" type="password" autoComplete="current-password" required minLength={8} />
      </Field>
      <Button type="submit" disabled={pending} block>
        {pending ? m.signingIn : m.signInButton}
      </Button>
    </form>
  );
}

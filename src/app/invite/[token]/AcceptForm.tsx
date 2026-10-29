"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api, errorMessage } from "@/lib/api";

/**
 * Accepting creates the account (new email) or checks the existing password,
 * and the response signs the person in, acting in the invited shop.
 */
export function AcceptForm({ token, hasAccount, m, t }: { token: string; hasAccount: boolean; m: ShopMessages; t: CommonMessages }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(f: FormData) {
    setPending(true);
    setError(null);
    try {
      const { role } = await api<{ role: string | null }>(`/api/public/invites/${encodeURIComponent(token)}/accept`, {
        // The API needs a name either way but only uses it for a new account.
        body: { name: hasAccount ? "-" : String(f.get("name") ?? "").trim(), password: String(f.get("password") ?? "") },
      });
      router.push(role === "delivery" ? "/dashboard/deliveries" : "/dashboard");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e, t.error));
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault(); // keeps the typed name if the API refuses
        submit(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      <Alert tone="note">{hasAccount ? m.signInToAccept : m.createAccount}</Alert>
      {error && <Alert tone="error">{error}</Alert>}
      {!hasAccount && (
        <Field label={m.yourName}>
          <Input name="name" autoComplete="name" required maxLength={100} />
        </Field>
      )}
      <Field label={m.password} hint={hasAccount ? undefined : m.passwordHint}>
        <Input name="password" type="password" autoComplete={hasAccount ? "current-password" : "new-password"} required minLength={8} maxLength={128} />
      </Field>
      <Button type="submit" disabled={pending} block className="min-h-12 text-[15px]">
        {pending ? m.accepting : m.accept}
      </Button>
    </form>
  );
}

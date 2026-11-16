"use client";

import { useState, type FormEvent } from "react";
import { Alert, Button } from "@/components/ui";
import type { connectMessages } from "@/i18n/messages/connect";
import { authClient, followOAuthRedirect } from "@/lib/authClient";

type Scope = { id: string; label: string };

export function ConsentForm({ scopes, m }: { scopes: Scope[]; m: (typeof connectMessages)["en"] }) {
  const [ticked, setTicked] = useState<string[]>(scopes.map((s) => s.id));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    if (accept && ticked.length === 0) {
      setError(m.choosePermission);
      return;
    }
    setPending(true);
    setError(null);
    // The plugin client adds this page's signed query. The server narrows the
    // scopes again to what the role allows; offline_access keeps the assistant
    // connected when it asked for that.
    const { data } = await authClient.$fetch("/oauth2/consent", {
      method: "POST",
      body: accept ? { accept, scope: [...ticked, "offline_access"].join(" ") } : { accept },
    });
    if (!followOAuthRedirect(data)) {
      setError(m.expired);
      setPending(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void answer(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      {scopes.length === 0 ? (
        <Alert tone="info">{m.consentNoPermissions}</Alert>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">{m.consentPermissions}</legend>
          {scopes.map((scope) => (
            <label key={scope.id} className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={ticked.includes(scope.id)}
                onChange={(e) =>
                  setTicked((t) => (e.target.checked ? [...t, scope.id] : t.filter((id) => id !== scope.id)))
                }
                className="size-4"
              />
              <span>{scope.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-sm text-sl-muted">{m.consentMasked}</p>
      <div className="flex gap-2">
        <Button type="button" tone="secondary" disabled={pending} onClick={() => void answer(false)} className="flex-1 min-h-12">
          {m.deny}
        </Button>
        <Button type="submit" disabled={pending || scopes.length === 0} className="flex-1 min-h-12">
          {pending ? m.working : m.approve}
        </Button>
      </div>
    </form>
  );
}

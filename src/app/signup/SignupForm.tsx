"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import type { authMessages } from "@/i18n/messages/auth";
import { api, errorMessage } from "@/lib/api";

/** "Layla's Boutique" -> "laylas-boutique". */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
}

export function SignupForm({ m }: { m: (typeof authMessages)["en"] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "LBP">("USD");

  async function submit(form: FormData) {
    setPending(true);
    setError(null);
    const optionalInt = (key: string) => (form.get(key) ? Number(form.get(key)) : undefined);
    try {
      await api("/api/signup", {
        body: {
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          shopName: form.get("shopName"),
          shopSlug: slug,
          currency,
          usdLbpRate: form.get("usdLbpRate") || undefined,
          baselineOrdersPerDay: optionalInt("baselineOrdersPerDay"),
          baselineConfirmMinutes: optionalInt("baselineConfirmMinutes"),
        },
      });
      router.push("/dashboard/products?welcome=1");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label={m.yourName}>
        <Input name="name" autoComplete="name" required maxLength={100} />
      </Field>
      <Field label={m.email}>
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label={m.password} hint={m.passwordHint}>
        <Input name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label={m.shopName}>
        <Input
          name="shopName"
          required
          maxLength={100}
          onChange={(e) => {
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label={m.shopLink} hint={m.shopLinkHint}>
        <div className="flex items-center gap-1" dir="ltr">
          <span className="shrink-0 text-sm text-stone-500">/s/</span>
          <Input
            name="shopSlug"
            required
            value={slug}
            pattern="[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])"
            autoCapitalize="none"
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </div>
      </Field>
      <Field label={m.currency}>
        <Select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "LBP")}>
          <option value="USD">{m.usd}</option>
          <option value="LBP">{m.lbp}</option>
        </Select>
      </Field>
      <Field label={m.rate} hint={m.rateHint}>
        <Input name="usdLbpRate" inputMode="decimal" placeholder="89500" required={currency === "LBP"} pattern="\d{1,9}(\.\d{1,2})?" />
      </Field>
      <Card className="flex flex-col gap-3 bg-stone-50">
        <div>
          <p className="text-sm font-medium">{m.baselineTitle}</p>
          <p className="text-xs text-stone-500">{m.baselineHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={m.baselineOrders}>
            <Input name="baselineOrdersPerDay" type="number" inputMode="numeric" min={0} max={10000} />
          </Field>
          <Field label={m.baselineMinutes}>
            <Input name="baselineConfirmMinutes" type="number" inputMode="numeric" min={0} max={100000} />
          </Field>
        </div>
      </Card>
      <Button type="submit" disabled={pending} block>
        {pending ? m.creating : m.createButton}
      </Button>
    </form>
  );
}

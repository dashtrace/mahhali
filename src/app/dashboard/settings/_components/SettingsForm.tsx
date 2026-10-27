"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { toAmountText } from "@/lib/format";
import { CardHead } from "../../products/_components/ProductExtras";
import { submitWith, useAction } from "../../products/_components/useAction";

type Settings = {
  name: string;
  currency: "USD" | "LBP";
  usdLbpRate: string | null;
  deliveryFeeMinor: number;
  codToleranceMinor: number;
  autoCancelHours: number | null;
  language: string;
};

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// The WhatsApp number lives on the Storefront tab; leaving it out of this PATCH keeps it as it is.
export function SettingsForm({ settings: s, catalogueUrl, m, t }: { settings: Settings; catalogueUrl: string; m: ShopMessages; t: CommonMessages }) {
  const save = useAction(t.error);
  const [saved, setSaved] = useState(false);
  const amount = fill(m.deliveryFee, { currency: s.currency });
  const amountPattern = s.currency === "USD" ? "\\d+(\\.\\d{1,2})?" : "\\d+";

  async function submit(f: FormData) {
    setSaved(false);
    const rate = text(f, "usdLbpRate");
    const hours = text(f, "autoCancelHours");
    const body = {
      name: text(f, "name"),
      language: text(f, "language"),
      deliveryFee: text(f, "deliveryFee") || "0",
      codTolerance: text(f, "codTolerance") || "0",
      autoCancelHours: hours ? Number(hours) : null,
      // The rate cannot be cleared once set, so an empty box leaves it as it is.
      ...(rate ? { usdLbpRate: rate } : {}),
    };
    setSaved(await save.run(() => api("/api/shop/settings", { method: "PATCH", body })));
  }

  return (
    <Card className="max-w-3xl">
      <form key={JSON.stringify(s)} onSubmit={submitWith(submit)} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <CardHead title={m.shopDetails} />
        </div>
        <Field label={m.shopName}>
          <Input name="name" defaultValue={s.name} required maxLength={100} />
        </Field>
        <Field label={m.catalogueLink}>
          <a href={catalogueUrl} target="_blank" rel="noreferrer" dir="ltr" className="flex min-h-11 items-center break-all font-bold text-sl-accent underline underline-offset-4">
            {catalogueUrl}
          </a>
        </Field>
        <Field label={m.currency} hint={m.currencyFixed}>
          <Input value={s.currency} disabled readOnly />
        </Field>
        <Field label={m.customerLanguage}>
          <Select name="language" defaultValue={s.language}>
            <option value="en">{t.english}</option>
            <option value="ar">{t.arabic}</option>
          </Select>
        </Field>
        <Field label={amount}>
          <Input name="deliveryFee" defaultValue={toAmountText(s.deliveryFeeMinor, s.currency)} dir="ltr" inputMode="decimal" pattern={amountPattern} />
        </Field>
        <Field label={fill(m.codTolerance, { currency: s.currency })} hint={m.codToleranceHint}>
          <Input name="codTolerance" defaultValue={toAmountText(s.codToleranceMinor, s.currency)} dir="ltr" inputMode="decimal" pattern={amountPattern} />
        </Field>
        <Field label={m.rate} hint={m.rateHint}>
          <Input name="usdLbpRate" defaultValue={s.usdLbpRate ?? ""} dir="ltr" inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="89500" />
        </Field>
        <Field label={m.autoCancel} hint={m.autoCancelHint}>
          <Input name="autoCancelHours" type="number" dir="ltr" min={1} max={720} defaultValue={s.autoCancelHours ?? ""} inputMode="numeric" />
        </Field>
        {save.error && <Alert tone="error" className="sm:col-span-2">{save.error}</Alert>}
        {saved && <Alert tone="success" className="sm:col-span-2">{t.saved}</Alert>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.busy}>
            {save.busy ? t.saving : t.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { toAmountText } from "@/lib/format";
import { DashIcon } from "../../_components/DashIcon";
import { submitWith, useSave } from "../../products/_components/useAction";
import { SaveBtn, SettingField } from "./fields";
import { useLivePreview } from "./LivePreview";

type Settings = {
  name: string;
  currency: "USD" | "LBP";
  usdLbpRate: string | null;
  deliveryFeeMinor: number;
  codToleranceMinor: number;
  autoCancelHours: number | null;
  language: string;
};
type Msgs = { m: ShopMessages; t: CommonMessages };

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// The WhatsApp number lives on the Storefront tab; leaving it out of these PATCHes keeps it as it is.
export function SettingsForm({ settings, catalogueUrl, m, t }: { settings: Settings; catalogueUrl: string } & Msgs) {
  return (
    <>
      <IdentityForm settings={settings} catalogueUrl={catalogueUrl} m={m} t={t} />
      <DeliveryForm settings={settings} m={m} t={t} />
    </>
  );
}

function CopyLink({ url, m }: { url: string; m: ShopMessages }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn tiny"
      aria-label={copied ? m.linkCopied : m.copyLink}
      title={copied ? m.linkCopied : m.copyLink}
      onClick={() =>
        navigator.clipboard.writeText(url).then(
          () => setCopied(true),
          // No clipboard access: leave the link selected to copy by hand.
          () => (document.getElementById("catalogue-link") as HTMLInputElement | null)?.select(),
        )
      }
    >
      <DashIcon name={copied ? "check" : "copy"} size="sm" />
    </button>
  );
}

function IdentityForm({ settings: s, catalogueUrl, m, t }: { settings: Settings; catalogueUrl: string } & Msgs) {
  const save = useSave(t.error);
  const preview = useLivePreview();

  async function submit(f: FormData) {
    const body = { name: text(f, "name"), language: text(f, "language") };
    if (await save.save(() => api("/api/shop/settings", { method: "PATCH", body }))) preview.reload();
  }

  return (
    <form
      // Only this form's own values: a save in the other form must not wipe unsaved edits here.
      key={JSON.stringify([s.name, s.language])}
      {...save.form}
      onChange={(e) => {
        save.form.onChange(e);
        const f = new FormData(e.currentTarget);
        preview.draft({ name: text(f, "name") || s.name, language: text(f, "language") });
      }}
      onSubmit={submitWith(submit)}
      className="card"
    >
      <h2>{m.identityTitle}</h2>
      <p className="hint">{m.identityHint}</p>
      <div className="split">
        <SettingField label={m.shopName}>
          <input name="name" className="control" defaultValue={s.name} required maxLength={100} />
        </SettingField>
        <SettingField label={m.customerLanguage} hint={m.customerLanguageHint}>
          <select name="language" className="control" defaultValue={s.language}>
            <option value="en">{t.english}</option>
            <option value="ar">{t.arabic}</option>
          </select>
        </SettingField>
        <SettingField label={m.currency} hint={m.currencyFixed}>
          <input className="control" value={s.currency} readOnly />
        </SettingField>
        <div className="field">
          <label htmlFor="catalogue-link">{m.catalogueLink}</label>
          <div className="field-inline">
            <input id="catalogue-link" className="control" value={catalogueUrl} dir="ltr" readOnly />
            <CopyLink url={catalogueUrl} m={m} />
          </div>
          <p>{m.catalogueLinkHint}</p>
        </div>
      </div>
      {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
      <SaveBtn state={save} labels={t}>
        {m.saveIdentity}
      </SaveBtn>
    </form>
  );
}

function DeliveryForm({ settings: s, m, t }: { settings: Settings } & Msgs) {
  const save = useSave(t.error);
  const preview = useLivePreview();
  const amountPattern = s.currency === "USD" ? "\\d+(\\.\\d{1,2})?" : "\\d+";

  async function submit(f: FormData) {
    const rate = text(f, "usdLbpRate");
    const hours = text(f, "autoCancelHours");
    const body = {
      deliveryFee: text(f, "deliveryFee") || "0",
      codTolerance: text(f, "codTolerance") || "0",
      autoCancelHours: hours ? Number(hours) : null,
      // The rate cannot be cleared once set, so an empty box leaves it as it is.
      ...(rate ? { usdLbpRate: rate } : {}),
    };
    if (await save.save(() => api("/api/shop/settings", { method: "PATCH", body }))) preview.reload();
  }

  return (
    <form
      key={JSON.stringify([s.deliveryFeeMinor, s.codToleranceMinor, s.usdLbpRate, s.autoCancelHours])}
      {...save.form}
      onSubmit={submitWith(submit)}
      className="card"
    >
      <h2>{m.deliveryTitle}</h2>
      <p className="hint">{m.deliveryHint}</p>
      <div className="split">
        <SettingField label={fill(m.deliveryFee, { currency: s.currency })} hint={m.deliveryFeeHint}>
          <input name="deliveryFee" className="control" defaultValue={toAmountText(s.deliveryFeeMinor, s.currency)} dir="ltr" inputMode="decimal" pattern={amountPattern} />
        </SettingField>
        <SettingField label={m.rate} hint={m.rateHint}>
          <input name="usdLbpRate" className="control" defaultValue={s.usdLbpRate ?? ""} dir="ltr" inputMode="decimal" pattern="\d+(\.\d{1,2})?" placeholder="89500" />
        </SettingField>
        <SettingField label={fill(m.codTolerance, { currency: s.currency })} hint={m.codToleranceHint}>
          <input name="codTolerance" className="control" defaultValue={toAmountText(s.codToleranceMinor, s.currency)} dir="ltr" inputMode="decimal" pattern={amountPattern} />
        </SettingField>
        <SettingField label={m.autoCancel} hint={m.autoCancelHint}>
          <input name="autoCancelHours" type="number" className="control" dir="ltr" min={1} max={720} defaultValue={s.autoCancelHours ?? ""} inputMode="numeric" placeholder={m.autoCancelNever} />
        </SettingField>
      </div>
      {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
      <SaveBtn state={save} labels={t}>
        {m.saveDelivery}
      </SaveBtn>
    </form>
  );
}

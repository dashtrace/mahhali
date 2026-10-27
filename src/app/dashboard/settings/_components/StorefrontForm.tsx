"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input, Segmented, Textarea, Toggle } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { CardHead } from "../../products/_components/ProductExtras";
import { submitWith, useAction } from "../../products/_components/useAction";

type Storefront = {
  tagline: string | null;
  about: string | null;
  shippingInfo: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  logoMode: string;
  homeSection: string;
  showTestimonials: boolean;
};
type Props = { storefront: Storefront; whatsappPhone: string | null; m: ShopMessages; t: CommonMessages };

const LOGO_MODES = [
  ["image-and-name", "logoImageAndName"],
  ["image-only", "logoImageOnly"],
  ["name-only", "logoNameOnly"],
] as const;
const HOME_SECTIONS = ["bestsellers", "new", "featured", "hidden"] as const;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** A labelled single choice drawn as a segmented control. */
function Choice({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      {children}
      {hint && <span className="text-xs leading-normal text-sl-muted">{hint}</span>}
    </div>
  );
}

export function StorefrontForm({ storefront: s, whatsappPhone, m, t }: Props) {
  const save = useAction(t.error);
  const [saved, setSaved] = useState(false);
  const [logoMode, setLogoMode] = useState(s.logoMode);
  const [homeSection, setHomeSection] = useState(s.homeSection);

  async function submit(f: FormData) {
    setSaved(false);
    const body = {
      tagline: text(f, "tagline"),
      about: text(f, "about"),
      shippingInfo: text(f, "shippingInfo"),
      instagramUrl: text(f, "instagramUrl"),
      facebookUrl: text(f, "facebookUrl"),
      logoMode,
      homeSection,
      showTestimonials: f.get("showTestimonials") === "on",
    };
    const phone = text(f, "whatsappPhone") || null;
    // Two endpoints: the number belongs to the shop settings (it also feeds the order board).
    setSaved(
      await save.run(async () => {
        await api("/api/shop/storefront", { method: "PATCH", body });
        if (phone !== whatsappPhone) await api("/api/shop/settings", { method: "PATCH", body: { whatsappPhone: phone } });
      }),
    );
  }

  return (
    <form key={JSON.stringify([s, whatsappPhone])} onSubmit={submitWith(submit)} className="flex max-w-3xl flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHead title={m.storefrontTitle} hint={m.storefrontHint} />
        <Field label={m.tagline} hint={m.taglineHint}>
          <Input name="tagline" defaultValue={s.tagline ?? ""} maxLength={80} />
        </Field>
        <Choice label={m.logoMode} hint={m.logoModeHint}>
          <Segmented label={m.logoMode} items={LOGO_MODES.map(([v, key]) => ({ label: m[key], current: logoMode === v, onClick: () => setLogoMode(v) }))} />
        </Choice>
        <Choice label={m.homeSection} hint={m.homeSectionHint}>
          <Segmented label={m.homeSection} items={HOME_SECTIONS.map((v) => ({ label: m[`home${v}`], current: homeSection === v, onClick: () => setHomeSection(v) }))} />
        </Choice>
        <Toggle name="showTestimonials" label={m.showTestimonials} hint={m.showTestimonialsHint} defaultChecked={s.showTestimonials} />
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHead title={m.pagesTitle} />
        <Field label={m.about} hint={m.aboutHint}>
          <Textarea name="about" defaultValue={s.about ?? ""} maxLength={2000} rows={5} />
        </Field>
        <Field label={m.shippingInfo} hint={m.shippingInfoHint}>
          <Textarea name="shippingInfo" defaultValue={s.shippingInfo ?? ""} maxLength={2000} rows={4} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHead title={m.socialTitle} />
        <Field label={m.instagramUrl} hint={fill(m.socialHint, { example: "https://www.instagram.com/yourshop" })}>
          <Input name="instagramUrl" type="url" dir="ltr" defaultValue={s.instagramUrl ?? ""} maxLength={300} placeholder="https://www.instagram.com/…" />
        </Field>
        <Field label={m.facebookUrl} hint={fill(m.socialHint, { example: "https://www.facebook.com/yourshop" })}>
          <Input name="facebookUrl" type="url" dir="ltr" defaultValue={s.facebookUrl ?? ""} maxLength={300} placeholder="https://www.facebook.com/…" />
        </Field>
        <Field label={m.whatsapp} hint={m.whatsappHint}>
          <Input name="whatsappPhone" type="tel" inputMode="tel" dir="ltr" defaultValue={whatsappPhone ?? ""} placeholder="+961…" />
        </Field>
      </Card>

      {save.error && <Alert tone="error">{save.error}</Alert>}
      {saved && <Alert tone="success">{t.saved}</Alert>}
      <Button type="submit" disabled={save.busy} className="self-start">
        {save.busy ? t.saving : t.save}
      </Button>
    </form>
  );
}

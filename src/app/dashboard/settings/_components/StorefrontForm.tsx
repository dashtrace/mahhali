"use client";

import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { submitWith, useSave } from "../../products/_components/useAction";
import { SaveBtn, SettingField } from "./fields";
import { useLivePreview } from "./LivePreview";

type Storefront = {
  tagline: string | null;
  about: string | null;
  shippingInfo: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  logoMode: string;
  homeSection: string;
  homeCategoryId: string | null;
  showTestimonials: boolean;
};
type Msgs = { m: ShopMessages; t: CommonMessages };
type Props = { storefront: Storefront; categories: { id: string; name: string }[]; whatsappPhone: string | null } & Msgs;

const LOGO_MODES = [
  ["image-and-name", "logoImageAndName"],
  ["image-only", "logoImageOnly"],
  ["name-only", "logoNameOnly"],
] as const;
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** The content form's fields, for the save and for the preview. */
function contentOf(f: FormData) {
  // "category:<id>" picks a category; "category:" follows the first one.
  const [homeSection, homeCategoryId] = text(f, "highlight").split(":");
  return {
    tagline: text(f, "tagline"),
    logoMode: text(f, "logoMode"),
    about: text(f, "about"),
    shippingInfo: text(f, "shippingInfo"),
    homeSection,
    ...(homeSection === "category" ? { homeCategoryId: homeCategoryId || null } : {}),
    showTestimonials: f.get("showTestimonials") === "on",
  };
}

export function StorefrontForm({ storefront, categories, whatsappPhone, m, t }: Props) {
  return (
    <>
      <ContentForm storefront={storefront} categories={categories} m={m} t={t} />
      <ContactForm storefront={storefront} whatsappPhone={whatsappPhone} m={m} t={t} />
    </>
  );
}

function ContentForm({ storefront: s, categories, m, t }: Pick<Props, "storefront" | "categories"> & Msgs) {
  const save = useSave(t.error);
  const preview = useLivePreview();

  async function submit(f: FormData) {
    if (await save.save(() => api("/api/shop/storefront", { method: "PATCH", body: contentOf(f) }))) preview.reload();
  }

  return (
    <form
      // Only this form's own values: a save in the other form must not wipe unsaved edits here.
      key={JSON.stringify([s.tagline, s.logoMode, s.homeSection, s.homeCategoryId, s.showTestimonials, s.about, s.shippingInfo])}
      {...save.form}
      onChange={(e) => {
        save.form.onChange(e);
        preview.draft(contentOf(new FormData(e.currentTarget)));
      }}
      onSubmit={submitWith(submit)}
    >
      <div className="card">
        <h2>{m.storefrontTitle}</h2>
        <p className="hint">{m.storefrontHint}</p>
        <SettingField label={m.tagline} hint={m.taglineHint}>
          <input name="tagline" className="control" defaultValue={s.tagline ?? ""} maxLength={80} />
        </SettingField>
        <SettingField label={m.logoMode} hint={m.logoModeHint}>
          <select name="logoMode" className="control" defaultValue={s.logoMode}>
            {LOGO_MODES.map(([v, key]) => (
              <option key={v} value={v}>
                {m[key]}
              </option>
            ))}
          </select>
        </SettingField>
        <SettingField label={m.homeSection} hint={m.homeSectionHint}>
          <select name="highlight" className="control" defaultValue={s.homeSection === "category" ? `category:${s.homeCategoryId ?? ""}` : s.homeSection}>
            <option value="category:">{m.homecategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={`category:${c.id}`}>
                {fill(m.homeCategoryNamed, { name: c.name })}
              </option>
            ))}
            {(["new", "bestsellers", "featured", "hidden"] as const).map((v) => (
              <option key={v} value={v}>
                {m[`home${v}`]}
              </option>
            ))}
          </select>
        </SettingField>
        <div className="field">
          <label>
            <input type="checkbox" name="showTestimonials" defaultChecked={s.showTestimonials} className="me-1 size-[17px] align-middle" /> {m.showTestimonials}
          </label>
          <p>{m.showTestimonialsHint}</p>
        </div>
      </div>

      <div className="card">
        <h2>{m.pagesTitle}</h2>
        <p className="hint">{m.pagesHint}</p>
        <SettingField label={m.about} hint={m.aboutHint}>
          <textarea name="about" className="control area" defaultValue={s.about ?? ""} maxLength={2000} rows={5} />
        </SettingField>
        <SettingField label={m.shippingInfo} hint={m.shippingInfoHint}>
          <textarea name="shippingInfo" className="control area" defaultValue={s.shippingInfo ?? ""} maxLength={2000} rows={4} />
        </SettingField>
        {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
        <SaveBtn state={save} labels={t}>
          {m.saveContent}
        </SaveBtn>
      </div>
    </form>
  );
}

function ContactForm({ storefront: s, whatsappPhone, m, t }: Pick<Props, "storefront" | "whatsappPhone"> & Msgs) {
  const save = useSave(t.error);
  const preview = useLivePreview();

  async function submit(f: FormData) {
    const phone = text(f, "whatsappPhone") || null;
    const links = { instagramUrl: text(f, "instagramUrl"), facebookUrl: text(f, "facebookUrl") };
    // Two endpoints: the number belongs to the shop settings (it also feeds the order board).
    const saved = await save.save(async () => {
      await api("/api/shop/storefront", { method: "PATCH", body: links });
      if (phone !== whatsappPhone) await api("/api/shop/settings", { method: "PATCH", body: { whatsappPhone: phone } });
    });
    if (saved) preview.reload();
  }

  return (
    <form
      key={JSON.stringify([s.instagramUrl, s.facebookUrl, whatsappPhone])}
      {...save.form}
      onChange={(e) => {
        save.form.onChange(e);
        const f = new FormData(e.currentTarget);
        preview.draft({ instagramUrl: text(f, "instagramUrl"), facebookUrl: text(f, "facebookUrl"), whatsappPhone: text(f, "whatsappPhone") || null });
      }}
      onSubmit={submitWith(submit)}
      className="card"
    >
      <h2>{m.socialTitle}</h2>
      <div className="split">
        <SettingField label={m.instagramUrl} hint={fill(m.socialHint, { example: "https://www.instagram.com/yourshop" })}>
          <input name="instagramUrl" type="url" className="control" dir="ltr" defaultValue={s.instagramUrl ?? ""} maxLength={300} placeholder="https://www.instagram.com/…" />
        </SettingField>
        <SettingField label={m.facebookUrl} hint={fill(m.socialHint, { example: "https://www.facebook.com/yourshop" })}>
          <input name="facebookUrl" type="url" className="control" dir="ltr" defaultValue={s.facebookUrl ?? ""} maxLength={300} placeholder="https://www.facebook.com/…" />
        </SettingField>
        <SettingField label={m.whatsapp} hint={m.whatsappHint}>
          <input name="whatsappPhone" type="tel" inputMode="tel" className="control" dir="ltr" defaultValue={whatsappPhone ?? ""} placeholder="+961…" />
        </SettingField>
      </div>
      {save.error && <Alert tone="error" className="mb-3">{save.error}</Alert>}
      <SaveBtn state={save} labels={t}>
        {m.saveContact}
      </SaveBtn>
    </form>
  );
}

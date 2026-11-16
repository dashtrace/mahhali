"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { validHeroTarget, type HeroCategory, type HeroTarget } from "@/app/s/[slug]/_components/heroDestination";
import { NEW_SLIDE } from "../../../preview/storefront/draft";
import { DashIcon } from "../../_components/DashIcon";
import { submitWith, useAction, useSave } from "../../products/_components/useAction";
import { SaveBtn, SettingField } from "./fields";
import { useLivePreview, useUnsaved } from "./LivePreview";

type Slide = HeroTarget & { ctaLabel?: string | null; id: string; imageUrl: string; mobileImageUrl?: string | null; kicker: string | null; title: string; body: string | null };
type Text = { kicker: string; title: string; body: string; ctaLabel: string; ctaCategoryId: string; ctaCollectionId: string; ctaSectionId: string };
type Msgs = { m: ShopMessages; t: CommonMessages };

const ACCEPT = "image/png,image/jpeg,image/webp";

/** Controlled slide copy and CTA fields, shared by creation, editing and the live preview. */
function TextFields({ value, onChange, categories, m }: { value: Text; onChange: (v: Text) => void; categories: HeroCategory[]; m: ShopMessages }) {
  const set = (k: keyof Text) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  // Offer every existing destination directly, keeping the full path for duplicate names.
  const groups = categories.map((category) => ({
    id: category.id,
    name: category.name,
    options: [
      { key: `category:${category.id}`, label: category.name, ctaCategoryId: category.id, ctaCollectionId: "", ctaSectionId: "" },
      ...(category.collections ?? []).flatMap((collection) => [
        { key: `collection:${collection.id}`, label: `${category.name} → ${collection.name}`, ctaCategoryId: category.id, ctaCollectionId: collection.id, ctaSectionId: "" },
        ...collection.sections.map((section) => ({
          key: `section:${section.id}`, label: `${category.name} → ${collection.name} → ${section.name}`,
          ctaCategoryId: category.id, ctaCollectionId: collection.id, ctaSectionId: section.id,
        })),
      ]),
    ],
  }));
  const options = groups.flatMap((group) => group.options);
  const selected = options.find((option) => option.ctaCategoryId === value.ctaCategoryId && option.ctaCollectionId === value.ctaCollectionId && option.ctaSectionId === value.ctaSectionId);
  return (
    <>
      <div className="split">
        <SettingField label={m.kicker}>
          <input className="control" value={value.kicker} onChange={set("kicker")} maxLength={40} placeholder={m.kickerPlaceholder} />
        </SettingField>
        <SettingField label={m.slideTitle}>
          <input className="control" value={value.title} onChange={set("title")} required maxLength={80} placeholder={m.slideTitlePlaceholder} />
        </SettingField>
      </div>
      <SettingField label={m.slideBody}>
        <input className="control" value={value.body} onChange={set("body")} maxLength={160} placeholder={m.slideBodyPlaceholder} />
      </SettingField>
      <SettingField label={m.ctaLabel}>
        <input className="control" value={value.ctaLabel} onChange={set("ctaLabel")} maxLength={40} placeholder={m.slideButtonLabel} dir="auto" />
      </SettingField>
      <p className="hint">{m.ctaLabelHint}</p>
      <SettingField label={m.ctaDestination}>
        <select className="control" value={selected?.key ?? ""} onChange={(e) => {
          const target = options.find((option) => option.key === e.target.value);
          onChange({ ...value, ctaCategoryId: target?.ctaCategoryId ?? "", ctaCollectionId: target?.ctaCollectionId ?? "", ctaSectionId: target?.ctaSectionId ?? "" });
        }}>
          <option value="">{m.ctaAllProducts}</option>
          {groups.map((group) => <optgroup key={group.id} label={group.name}>
            {group.options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </optgroup>)}
        </select>
      </SettingField>
      <p className="hint">{m.ctaDestinationHint}</p>
    </>
  );
}

export function SlidesEditor({ slides, categories, max, m, t }: { slides: Slide[]; categories: HeroCategory[]; max: number } & Msgs) {
  return (
    <>
      <div className="card">
        <div className="between mb-[9px]">
          <h2 className="mb-0">{m.slidesTitle}</h2>
          <span className="mini-badge gray">{fill(m.slideCount, { n: slides.length, max })}</span>
        </div>
        <p className="hint">{m.slidesHint}</p>
        <div className="info-inline">
          <DashIcon name="info" size="sm" /> {m.slideImageHint}
        </div>
      </div>
      {slides.length === 0 && (
        <div className="empty mb-3">
          <strong>{m.noSlides}</strong>
        </div>
      )}
      {slides.map((s, i) => (
        <SlideCard categories={categories} key={s.id} slide={s} index={i} last={i === slides.length - 1} m={m} t={t} />
      ))}
      {slides.length >= max ? <div className="info-inline">{fill(m.slideLimit, { max })}</div> : <AddSlide categories={categories} index={slides.length} max={max} m={m} t={t} />}
    </>
  );
}

function SlideCard({ slide: s, categories, index, last, m, t }: { slide: Slide; categories: HeroCategory[]; index: number; last: boolean } & Msgs) {
  const [text, setText] = useState<Text>(() => {
    const target = validHeroTarget(s, categories);
    return { kicker: s.kicker ?? "", title: s.title, body: s.body ?? "", ctaLabel: s.ctaLabel ?? "",
      ctaCategoryId: target.ctaCategoryId ?? "", ctaCollectionId: target.ctaCollectionId ?? "", ctaSectionId: target.ctaSectionId ?? "" };
  });
  // Set from the upload's response, so the new image shows before the page refresh lands.
  const [image, setImage] = useState(s.imageUrl);
  const [mobileImage, setMobileImage] = useState(s.mobileImageUrl ?? null);
  const action = useSave(t.error, text);
  const preview = useLivePreview();
  useUnsaved(action.dirty);
  const name = fill(m.slideN, { n: index + 1 });
  const reloadIf = (ok: boolean) => {
    if (ok) preview.reload();
  };

  function changeImage(file: File, mobile = false) {
    const form = new FormData();
    form.set("file", file);
    action.run(async () => {
      const saved = await api<Slide>(`/api/shop/slides/${s.id}/${mobile ? "mobile-image" : "image"}`, { body: form });
      if (mobile) setMobileImage(saved.mobileImageUrl ?? null);
      else setImage(saved.imageUrl);
      preview.draft({ focus: index, slides: { [s.id]: { imageUrl: saved.imageUrl, mobileImageUrl: saved.mobileImageUrl ?? null } } });
    }).then(reloadIf);
  }
  function removeMobile() {
    action.run(async () => {
      await api(`/api/shop/slides/${s.id}/mobile-image`, { method: "DELETE" });
      setMobileImage(null);
      preview.draft({ focus: index, slides: { [s.id]: { mobileImageUrl: null } } });
    }).then(reloadIf);
  }
  const move = (position: number) => action.run(() => api(`/api/shop/slides/${s.id}`, { method: "PATCH", body: { position } })).then(reloadIf);
  const remove = fill(m.deleteSlide, { n: index + 1 });

  return (
    <div className="slide-item">
      <div className="between">
        <h3>{name}</h3>
        <div role="group" aria-label={name} className="slide-actions">
          <button type="button" disabled={action.busy || index === 0} onClick={() => move(index - 1)}>
            {m.moveUp}
          </button>
          <button type="button" disabled={action.busy || last} onClick={() => move(index + 1)}>
            {m.moveDown}
          </button>
          <button
            type="button"
            aria-label={remove}
            title={remove}
            disabled={action.busy}
            onClick={() => confirm(m.deleteSlideConfirm) && action.run(() => api(`/api/shop/slides/${s.id}`, { method: "DELETE" })).then(reloadIf)}
          >
            <DashIcon name="x" size="sm" />
          </button>
        </div>
      </div>
      <div className="cover">
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is */}
        <img src={image} alt={name} loading="lazy" />
      </div>
      <SettingField label={m.desktopImage} hint={m.desktopImageHint}>
        <input
          type="file"
          accept={ACCEPT}
          className="control"
          disabled={action.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) changeImage(file);
          }}
        />
      </SettingField>
      <MobileImageFields value={mobileImage} disabled={action.busy} onPick={(file) => changeImage(file, true)} onRemove={removeMobile} m={m} />
      <form onSubmit={submitWith(() => action.save(() => api(`/api/shop/slides/${s.id}`, { method: "PATCH", body: text })).then(reloadIf))}>
        <TextFields
          value={text}
          categories={categories}
          onChange={(next) => {
            setText(next);
            preview.draft({ focus: index, slides: { [s.id]: next } });
          }}
          m={m}
        />
        {action.error && <Alert tone="error" className="mb-3">{action.error}</Alert>}
        <SaveBtn state={action} labels={t} />
      </form>
    </div>
  );
}

function AddSlide({ index, categories, max, m, t }: { index: number; categories: HeroCategory[]; max: number } & Msgs) {
  const blank: Text = { kicker: "", title: "", body: "", ctaLabel: "", ctaCategoryId: "", ctaCollectionId: "", ctaSectionId: "" };
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<Text>(blank);
  const [pick, setPick] = useState<{ file: File; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [mobilePick, setMobilePick] = useState<{ file: File; url: string } | null>(null);
  const mobileUrl = mobilePick?.url;
  const add = useAction(t.error);
  const preview = useLivePreview();
  const router = useRouter();
  const url = pick?.url;
  const { kicker, title, body, ctaLabel, ctaCategoryId, ctaCollectionId, ctaSectionId } = text;
  useUnsaved(!!(url || mobileUrl || kicker || title || body || ctaLabel || ctaCategoryId));

  // The frame shares this origin, so it can show the picked file before it is uploaded.
  useEffect(() => {
    if (url) preview.draft({ focus: index, slides: { [NEW_SLIDE]: { imageUrl: url, mobileImageUrl: mobileUrl ?? null, kicker, title: title || m.slideTitlePlaceholder, body, ctaLabel, ctaCategoryId, ctaCollectionId, ctaSectionId } } });
    else preview.draft({ slides: { [NEW_SLIDE]: null } });
  }, [preview, url, mobileUrl, kicker, title, body, ctaLabel, ctaCategoryId, ctaCollectionId, ctaSectionId, index, m.slideTitlePlaceholder]);
  useEffect(() => () => { if (mobileUrl) URL.revokeObjectURL(mobileUrl); }, [mobileUrl]);
  // A refresh at the limit removes this form without close().
  useEffect(() => () => preview.draft({ slides: { [NEW_SLIDE]: null } }), [preview]);

  function clearPick() {
    if (pick) URL.revokeObjectURL(pick.url);
    setPick(null);
    if (input.current) input.current.value = "";
  }

  function close() {
    clearPick();
    setMobilePick(null);
    setText(blank);
    setOpen(false);
  }

  async function submit() {
    if (!pick) return;
    const form = new FormData();
    form.set("file", pick.file);
    if (mobilePick) form.set("mobileFile", mobilePick.file);
    form.set("title", text.title);
    form.set("kicker", text.kicker);
    form.set("body", text.body);
    form.set("ctaLabel", text.ctaLabel);
    form.set("ctaCategoryId", text.ctaCategoryId);
    form.set("ctaCollectionId", text.ctaCollectionId);
    form.set("ctaSectionId", text.ctaSectionId);
    // Refused because the slides filled up elsewhere: the refresh shows the real count, and at the limit replaces this form.
    if (await add.run(() => api("/api/shop/slides", { body: form }))) close();
    else router.refresh();
    preview.reload();
  }

  if (!open) {
    return (
      <button type="button" className="btn primary" onClick={() => setOpen(true)}>
        <DashIcon name="plus" size="sm" />
        {fill(m.addHeroImage, { max })}
      </button>
    );
  }

  return (
    <form onSubmit={submitWith(submit)} className="slide-item">
      <h3>{m.newSlide}</h3>
      <p className="hint">{m.newSlideHint}</p>
      {pick && (
        <div className="cover">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local file the owner just picked */}
          <img src={pick.url} alt={m.newSlide} />
        </div>
      )}
      <SettingField label={m.desktopImage} hint={m.desktopImageHint}>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="control"
          required
          disabled={add.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (pick) URL.revokeObjectURL(pick.url);
            setPick(file ? { file, url: URL.createObjectURL(file) } : null);
          }}
        />
      </SettingField>
      {pick && (
        <button type="button" className="btn tiny mb-[17px]" disabled={add.busy} onClick={clearPick}>
          {m.removeImage}
        </button>
      )}
      <MobileImageFields value={mobileUrl ?? null} disabled={add.busy}
        onPick={(file) => setMobilePick({ file, url: URL.createObjectURL(file) })}
        onRemove={() => setMobilePick(null)} m={m} />
      <TextFields categories={categories} value={text} onChange={setText} m={m} />
      {add.error && <Alert tone="error" className="mb-3">{add.error}</Alert>}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={add.busy || !pick}>
          <DashIcon name="plus" size="sm" />
          {add.busy ? m.adding : m.addSlide}
        </button>
        <button type="button" className="btn" disabled={add.busy} onClick={close}>
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

/** A portrait thumbnail and an optional phone-only upload. Removing it restores desktop fallback. */
function MobileImageFields({ value, disabled, onPick, onRemove, m }: {
  value: string | null; disabled: boolean; onPick: (file: File) => void; onRemove: () => void; m: ShopMessages;
}) {
  return <div className="mb-5">
    {value && <div className="mb-3 max-w-[180px]">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded or locally picked product artwork */}
      <img src={value} alt={m.mobileImage} className="w-full rounded-lg" loading="lazy" />
    </div>}
    <SettingField label={m.mobileImage} hint={m.mobileImageHint}>
      <input type="file" accept={ACCEPT} className="control" disabled={disabled} onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (file) onPick(file);
      }} />
    </SettingField>
    {value && <button type="button" className="btn tiny" disabled={disabled} onClick={onRemove}>{m.removeMobileImage}</button>}
  </div>;
}

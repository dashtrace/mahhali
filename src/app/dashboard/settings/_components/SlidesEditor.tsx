"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import { NEW_SLIDE } from "../../../preview/storefront/draft";
import { DashIcon } from "../../_components/DashIcon";
import { submitWith, useAction, useSave } from "../../products/_components/useAction";
import { SaveBtn, SettingField } from "./fields";
import { useLivePreview } from "./LivePreview";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };
type Text = { kicker: string; title: string; body: string };
type Msgs = { m: ShopMessages; t: CommonMessages };

const ACCEPT = "image/png,image/jpeg,image/webp";

/** Small heading, main headline and description (controlled, so the preview follows), then the note about the button. */
function TextFields({ value, onChange, m }: { value: Text; onChange: (v: Text) => void; m: ShopMessages }) {
  const set = (k: keyof Text) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  const [before, after] = m.slideButtonNote.split("{label}");
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
      <p className="hint">
        {before}
        <b>{m.slideButtonLabel}</b>
        {after}
      </p>
    </>
  );
}

export function SlidesEditor({ slides, max, m, t }: { slides: Slide[]; max: number } & Msgs) {
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
        <SlideCard key={s.id} slide={s} index={i} last={i === slides.length - 1} m={m} t={t} />
      ))}
      {slides.length >= max ? <div className="info-inline">{fill(m.slideLimit, { max })}</div> : <AddSlide index={slides.length} max={max} m={m} t={t} />}
    </>
  );
}

function SlideCard({ slide: s, index, last, m, t }: { slide: Slide; index: number; last: boolean } & Msgs) {
  const [text, setText] = useState<Text>({ kicker: s.kicker ?? "", title: s.title, body: s.body ?? "" });
  // Set from the upload's response, so the new image shows before the page refresh lands.
  const [image, setImage] = useState(s.imageUrl);
  const action = useSave(t.error, text);
  const preview = useLivePreview();
  const name = fill(m.slideN, { n: index + 1 });
  const reloadIf = (ok: boolean) => {
    if (ok) preview.reload();
  };

  function changeImage(file: File) {
    const form = new FormData();
    form.set("file", file);
    action.run(async () => setImage((await api<{ imageUrl: string }>(`/api/shop/slides/${s.id}/image`, { body: form })).imageUrl)).then(reloadIf);
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
      <SettingField label={m.slideImage}>
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
      <form onSubmit={submitWith(() => action.save(() => api(`/api/shop/slides/${s.id}`, { method: "PATCH", body: text })).then(reloadIf))}>
        <TextFields
          value={text}
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

function AddSlide({ index, max, m, t }: { index: number; max: number } & Msgs) {
  const blank: Text = { kicker: "", title: "", body: "" };
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<Text>(blank);
  const [pick, setPick] = useState<{ file: File; url: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const add = useAction(t.error);
  const preview = useLivePreview();
  const url = pick?.url;
  const { kicker, title, body } = text;

  // The frame shares this origin, so it can show the picked file before it is uploaded.
  useEffect(() => {
    if (url) preview.draft({ focus: index, slides: { [NEW_SLIDE]: { imageUrl: url, kicker, title: title || m.slideTitlePlaceholder, body } } });
    else preview.draft({ slides: { [NEW_SLIDE]: null } });
  }, [preview, url, kicker, title, body, index, m.slideTitlePlaceholder]);

  function clearPick() {
    if (pick) URL.revokeObjectURL(pick.url);
    setPick(null);
    if (input.current) input.current.value = "";
  }

  function close() {
    clearPick();
    setText(blank);
    setOpen(false);
  }

  async function submit() {
    if (!pick) return;
    const form = new FormData();
    form.set("file", pick.file);
    form.set("title", text.title);
    form.set("kicker", text.kicker);
    form.set("body", text.body);
    if (await add.run(() => api("/api/shop/slides", { body: form }))) {
      close();
      preview.reload();
    }
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
      <SettingField label={m.slideImage}>
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
      <TextFields value={text} onChange={setText} m={m} />
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

"use client";

import { useState } from "react";
import { Alert, Button, Card, EmptyState, Field, IconButton, Input } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";
import type { CommonMessages } from "@/i18n/messages/common";
import type { ShopMessages } from "@/i18n/messages/shop";
import { api } from "@/lib/api";
import type { Theme } from "@/server/domain/theme";
import { themeTone, themeVars } from "../../../_server/theme";
import { FilePicker } from "../../products/_components/FilePicker";
import { CardHead } from "../../products/_components/ProductExtras";
import { submitWith, useAction } from "../../products/_components/useAction";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };
type Text = { kicker: string; title: string; body: string };
type Props = { slides: Slide[]; theme: Theme; max: number; m: ShopMessages; t: CommonMessages };
type Shared = { theme: Theme; m: ShopMessages; t: CommonMessages };

/** The home hero card in the shop's own colours, at dashboard size. Decorative: the fields beside it carry the text. */
function HeroPreview({ image, text, theme }: { image: string | null; text: Text; theme: Theme }) {
  return (
    <div aria-hidden className="sl-shop" data-tone={themeTone(theme)} style={themeVars(theme)}>
      <div className="relative h-[170px] overflow-hidden rounded-[21px] bg-sl-hero text-sl-hero-ink sm:h-[210px]">
        {image && (
          <div
            className="absolute inset-y-0 end-0 w-[56%] bg-cover bg-center [mask-image:linear-gradient(to_left,black_67%,transparent)] rtl:[mask-image:linear-gradient(to_right,black_67%,transparent)]"
            style={{ backgroundImage: `url(${JSON.stringify(image)})` }}
          />
        )}
        <div className="relative flex h-full max-w-[62%] flex-col justify-center gap-1.5 ps-5">
          {text.kicker && <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.15em] text-sl-accent rtl:tracking-normal">{text.kicker}</p>}
          <p className="sl-heading line-clamp-3 text-[21px] leading-tight">{text.title}</p>
          {text.body && <p className="line-clamp-2 text-xs leading-normal">{text.body}</p>}
        </div>
      </div>
    </div>
  );
}

/** Kicker, headline and description inputs (controlled, so the preview follows). */
function TextFields({ value, onChange, m }: { value: Text; onChange: (v: Text) => void; m: ShopMessages }) {
  const set = (k: keyof Text) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={m.kicker}>
        <Input value={value.kicker} onChange={set("kicker")} maxLength={40} placeholder={m.kickerPlaceholder} />
      </Field>
      <Field label={m.slideTitle}>
        <Input value={value.title} onChange={set("title")} required maxLength={80} placeholder={m.slideTitlePlaceholder} />
      </Field>
      <Field label={m.slideBody} className="sm:col-span-2">
        <Input value={value.body} onChange={set("body")} maxLength={160} placeholder={m.slideBodyPlaceholder} />
      </Field>
    </div>
  );
}

export function SlidesEditor({ slides, theme, max, m, t }: Props) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <CardHead title={m.slidesTitle} hint={fill(m.slidesHint, { max })} />
      {slides.length === 0 && <EmptyState title={m.noSlides} />}
      {slides.map((s, i) => (
        <SlideCard key={s.id} slide={s} index={i} last={i === slides.length - 1} theme={theme} m={m} t={t} />
      ))}
      {slides.length >= max ? <Alert tone="note">{fill(m.slideLimit, { max })}</Alert> : <AddSlide theme={theme} m={m} t={t} />}
    </div>
  );
}

function SlideCard({ slide: s, index, last, theme, m, t }: { slide: Slide; index: number; last: boolean } & Shared) {
  const [text, setText] = useState<Text>({ kicker: s.kicker ?? "", title: s.title, body: s.body ?? "" });
  const [saved, setSaved] = useState(false);
  const action = useAction(t.error);
  const n = index + 1;
  const move = (position: number) => action.run(() => api(`/api/shop/slides/${s.id}`, { method: "PATCH", body: { position } }));

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{fill(m.slideN, { n })}</h3>
        <div className="flex gap-1.5">
          <IconButton label={fill(m.moveSlideUp, { n })} icon={<Icon name="chevron" className="size-5 rotate-180" />} disabled={action.busy || index === 0} onClick={() => move(index - 1)} />
          <IconButton label={fill(m.moveSlideDown, { n })} icon="chevron" disabled={action.busy || last} onClick={() => move(index + 1)} />
          <IconButton
            label={fill(m.deleteSlide, { n })}
            icon="x"
            className="text-sl-danger"
            disabled={action.busy}
            onClick={() => confirm(m.deleteSlideConfirm) && action.run(() => api(`/api/shop/slides/${s.id}`, { method: "DELETE" }))}
          />
        </div>
      </div>
      <HeroPreview image={s.imageUrl} text={text} theme={theme} />
      <form
        onSubmit={submitWith(async () => {
          setSaved(false);
          setSaved(await action.run(() => api(`/api/shop/slides/${s.id}`, { method: "PATCH", body: text })));
        })}
        className="flex flex-col gap-3"
      >
        <TextFields
          value={text}
          onChange={(v) => {
            setSaved(false);
            setText(v);
          }}
          m={m}
        />
        {action.error && <Alert tone="error">{action.error}</Alert>}
        {saved && <Alert tone="success">{t.saved}</Alert>}
        <Button type="submit" tone="secondary" disabled={action.busy} className="self-start">
          {action.busy ? t.saving : t.save}
        </Button>
      </form>
    </Card>
  );
}

function AddSlide({ theme, m, t }: Shared) {
  const blank: Text = { kicker: "", title: "", body: "" };
  const [text, setText] = useState<Text>(blank);
  const [pick, setPick] = useState<{ file: File; url: string } | null>(null);
  const add = useAction(t.error);

  function choose(file: File) {
    if (pick) URL.revokeObjectURL(pick.url);
    setPick({ file, url: URL.createObjectURL(file) });
  }

  async function submit() {
    if (!pick) return;
    const form = new FormData();
    form.set("file", pick.file);
    form.set("title", text.title);
    form.set("kicker", text.kicker);
    form.set("body", text.body);
    if (await add.run(() => api("/api/shop/slides", { body: form }))) {
      URL.revokeObjectURL(pick.url);
      setPick(null);
      setText(blank);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-dashed border-sl-control">
      <CardHead title={m.addSlide} hint={m.slideImageHint} />
      <HeroPreview image={pick?.url ?? null} text={{ ...text, title: text.title || m.slideTitlePlaceholder }} theme={theme} />
      <form onSubmit={submitWith(submit)} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilePicker onFile={choose} busy={add.busy}>
            {pick ? m.changeImage : m.chooseImage}
          </FilePicker>
          {pick && <span className="min-w-0 truncate text-sm text-sl-muted">{pick.file.name}</span>}
        </div>
        <TextFields value={text} onChange={setText} m={m} />
        {add.error && <Alert tone="error">{add.error}</Alert>}
        <Button type="submit" disabled={add.busy || !pick} className="self-start">
          <Icon name="plus" />
          {add.busy ? m.adding : m.addSlide}
        </Button>
      </form>
    </Card>
  );
}

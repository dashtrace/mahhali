"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/Icon";
import { Alert, Button, ProductPhoto, cx } from "@/components/ui";
import { fill } from "@/i18n/locale";
import type { photoMessages } from "@/i18n/messages/photos";
import { colourCoverage, fitPicked } from "@/lib/photoSlots";
import { shrinkPhoto } from "@/lib/photoResize";

type Photo = { id: string; url: string; colour: string | null };
type Product = { id: string; name: string; colours: string[]; photos: Photo[]; photosLeft: number };
type Messages = (typeof photoMessages)["en"];
type Status = { tone: "info" | "success" | "error"; text: string } | null;
type Picked = { key: string; file: File; preview: string };

// Each product shows its 5 photo slots: photos already added (the first is the
// cover in the shop's lists), photos picked but not sent yet, and empty slots
// to tap. Picking only stages photos; "Add photos" sends them.
export function PhotoUploader({ token, products, max, m }: { token: string; products: Product[]; max: number; m: Messages }) {
  const [counts, setCounts] = useState(() => Object.fromEntries(products.map((p) => [p.id, p.photos.length])));
  const done = Object.values(counts).filter((n) => n > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-sl-muted">{m.howTo}</p>
      <p className="text-sm font-semibold">{fill(m.progress, { done, total: products.length })}</p>
      <ul className="flex flex-col gap-4">
        {products.map((p) => (
          <ProductPhotos key={p.id} token={token} product={p} max={max} m={m} onCount={(n) => setCounts((c) => ({ ...c, [p.id]: n }))} />
        ))}
      </ul>
      <p className="text-center text-sm text-sl-muted">{m.done}</p>
    </div>
  );
}

function ProductPhotos({
  token,
  product,
  max,
  m,
  onCount,
}: {
  token: string;
  product: Product;
  max: number;
  m: Messages;
  onCount: (n: number) => void;
}) {
  const [photos, setPhotos] = useState(product.photos);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [colour, setColour] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const pickInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Previews hold the photo in memory until they are removed, sent or the page closes.
  const live = useRef(picked);
  live.current = picked;
  useEffect(() => () => live.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);
  function clearPicked(keys?: string[]) {
    setPicked((prev) => {
      const gone = keys ? prev.filter((p) => keys.includes(p.key)) : prev;
      gone.forEach((p) => URL.revokeObjectURL(p.preview));
      return keys ? prev.filter((p) => !keys.includes(p.key)) : [];
    });
  }

  const used = photos.length + picked.length;
  const empty = Math.max(0, max - used);
  const coverage = colourCoverage(product.colours, photos);

  function stage(e: ChangeEvent<HTMLInputElement>) {
    const chosen = [...(e.target.files ?? [])];
    e.target.value = "";
    if (chosen.length === 0) return;
    const { kept, dropped } = fitPicked(chosen, used, max);
    setPicked((prev) => [
      ...prev,
      ...kept.map((file, i) => ({ key: `${Date.now()}-${i}-${file.name}`, file, preview: URL.createObjectURL(file) })),
    ]);
    setStatus(dropped > 0 ? { tone: "error", text: fill(m.droppedSome, { n: kept.length }) } : null);
  }


  async function send() {
    if (picked.length === 0) return;
    setBusy(true);
    setStatus({ tone: "info", text: fill(m.preparing, { n: picked.length }) });
    try {
      const ready = await Promise.all(picked.map((p) => shrinkPhoto(p.file)));
      if (ready.some((b) => b === null)) {
        setStatus({ tone: "error", text: m.unreadable });
        return;
      }
      const form = new FormData();
      form.set("productId", product.id);
      if (colour) form.set("colour", colour);
      ready.forEach((blob, i) => form.append("file", blob!, `photo-${i + 1}`));
      setStatus({ tone: "info", text: fill(m.uploading, { n: picked.length }) });
      const res = await fetch(`/api/public/photo-links/${token}/photos`, { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const code = body?.error?.code as keyof Messages | undefined;
        const text = res.status === 429 ? m.rateLimited : res.status === 404 ? m.linkDead : code && code in m ? m[code] : m.failed;
        setStatus({ tone: "error", text });
        return;
      }
      setPhotos(body.photos);
      onCount(body.photos.length);
      clearPicked();
      setStatus({ tone: "success", text: `${fill(m.added, { n: body.added })} ${m.live}` });
    } catch {
      setStatus({ tone: "error", text: m.failed });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-[14px] border border-sl-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-semibold">
          {photos.length > 0 && <Icon name="check" className="size-4 text-[#3f9f70]" />}
          {product.name}
        </h2>
        <span className="shrink-0 text-xs text-sl-muted">{fill(m.photosLeft, { n: photos.length, max })}</span>
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((photo, i) => (
          <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-sl-cat">
            <ProductPhoto src={photo.url} name={product.name} alt={photo.colour ?? product.name} />
            {i === 0 && (
              <span className="absolute start-1.5 top-1.5 rounded bg-sl-accent px-1.5 py-0.5 text-[11px] font-semibold text-white">{m.cover}</span>
            )}
            {photo.colour && (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-center text-[11px] text-white">{photo.colour}</span>
            )}
          </li>
        ))}
        {picked.map((p, i) => (
          <li key={p.key} className="relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-sl-accent">
            <ProductPhoto src={p.preview} name={product.name} alt={p.file.name} />
            {/* The tag sits in the bottom strip so the remove button keeps the top corner on small screens. */}
            <span className="absolute inset-x-0 bottom-0 truncate bg-sl-accent/90 px-1 py-0.5 text-center text-[11px] font-semibold text-white">
              {photos.length === 0 && i === 0 ? m.cover : m.newTag}
              {colour && ` · ${colour}`}
            </span>
            {!busy && (
              <button
                type="button"
                onClick={() => clearPicked([p.key])}
                aria-label={m.remove}
                className="absolute end-0 top-0 grid size-11 place-items-center"
              >
                <span className="grid size-7 place-items-center rounded-full bg-black/65 text-white">
                  <Icon name="x" className="size-4" />
                </span>
              </button>
            )}
          </li>
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`}>
            <button
              type="button"
              disabled={busy}
              onClick={() => pickInput.current?.click()}
              aria-label={m.addSlot}
              className={cx(
                "grid aspect-square min-h-11 w-full place-items-center rounded-lg border-2 border-dashed border-sl-border text-sl-muted",
                "hover:border-sl-accent hover:text-sl-accent disabled:opacity-50",
              )}
            >
              <Icon name="plus" className="size-5" />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-sl-muted">{photos.length > 0 ? m.coverHint : m.firstIsCover}</p>

      {coverage.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">{m.coloursTitle}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {coverage.map((c) => (
              <li
                key={c.colour}
                className={cx(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  c.count > 0 ? "border-[#3f9f70] text-[#3f9f70]" : "border-sl-border text-sl-muted",
                )}
              >
                {c.count > 0 && <Icon name="check" className="size-3" />}
                {c.colour}: {c.count > 0 ? fill(m.colourCount, { n: c.count }) : m.colourMissing}
              </li>
            ))}
          </ul>
          {coverage.some((c) => c.count === 0) && <p className="mt-1 text-xs text-sl-muted">{m.colourHint}</p>}
        </div>
      )}

      {picked.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3 rounded-lg bg-sl-cat p-3">
          {product.colours.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium">{m.pendingFor}</p>
              <div className="flex flex-wrap gap-1.5">
                {["", ...product.colours].map((c) => (
                  <button
                    key={c || "all"}
                    type="button"
                    disabled={busy}
                    onClick={() => setColour(c)}
                    aria-pressed={colour === c}
                    className={cx(
                      "min-h-11 rounded-full border px-4 text-sm",
                      colour === c ? "border-sl-accent bg-sl-accent text-white" : "border-sl-border bg-sl-panel",
                    )}
                  >
                    {c || m.allVariants}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Button type="button" disabled={busy} onClick={send}>
              {fill(m.addN, { n: picked.length })}
            </Button>
            <Button type="button" tone="secondary" disabled={busy} onClick={() => clearPicked()}>
              {m.cancel}
            </Button>
          </div>
        </div>
      ) : (
        empty > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Button type="button" tone="secondary" disabled={busy} onClick={() => pickInput.current?.click()}>
              {m.choose}
            </Button>
            <Button type="button" tone="secondary" disabled={busy} onClick={() => cameraInput.current?.click()}>
              {m.camera}
            </Button>
          </div>
        )
      )}
      {empty === 0 && picked.length === 0 && <p className="mt-3 text-sm text-sl-muted">{fill(m.full, { max })}</p>}

      <input ref={pickInput} type="file" accept="image/*" multiple hidden onChange={stage} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={stage} />

      {status && (
        <Alert tone={status.tone} className="mt-3">
          <span role="status">{status.text}</span>
        </Alert>
      )}
    </li>
  );
}

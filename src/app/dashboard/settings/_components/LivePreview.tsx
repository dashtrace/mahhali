"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sheet } from "@/components/Sheet";
import type { Locale } from "@/i18n/locale";
import type { ShopMessages } from "@/i18n/messages/shop";
import { PREVIEW_DRAFT, PREVIEW_READY, type PreviewDraft } from "../../../preview/storefront/draft";
import { DashIcon } from "../../_components/DashIcon";

const PHONE = "(max-width: 780px)";
const VIEWS = ["home", "shop", "product"] as const;

type Preview = { draft: (draft: PreviewDraft) => void; reload: () => void; open: () => void };
const PreviewContext = createContext<Preview>({ draft() {}, reload() {}, open() {} });

/** For a settings form: `draft` shows its current values, unsaved; `reload` after a save or an upload. */
export const useLivePreview = () => useContext(PreviewContext);

/** The page header's button: the frame in a side panel on desktop, a bottom sheet on phones. */
export function PreviewButton({ label }: { label: string }) {
  const { open } = useLivePreview();
  return (
    <button type="button" className="btn soft" onClick={open}>
      <DashIcon name="eye" size="sm" />
      {label}
    </button>
  );
}

function subscribePhone(onChange: () => void) {
  const query = matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The settings forms beside a phone showing the real storefront in a same-origin frame: sticky on
 * desktop, in a sheet on phones. The page keys this by tab, so a draft ends with its tab.
 * shortcut: leaving a tab with unsaved changes gives no warning, add one with a dirty flag from the forms if owners lose work.
 */
export function LivePreview({ locale, m, head, children }: { locale: Locale; m: ShopMessages; head: ReactNode; children: ReactNode }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef<PreviewDraft>({});
  const [view, setView] = useState<(typeof VIEWS)[number]>("home");
  const [loads, setLoads] = useState(0);
  const [open, setOpen] = useState(false);
  // Null until hydrated, so a phone never starts loading the frame it keeps in the sheet.
  const phone = useSyncExternalStore(subscribePhone, () => matchMedia(PHONE).matches, () => null);
  const labels = { home: m.previewHome, shop: m.previewShop, product: m.previewProduct };

  const send = () => frame.current?.contentWindow?.postMessage({ type: PREVIEW_DRAFT, draft: latest.current }, location.origin);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin === location.origin && e.source === frame.current?.contentWindow && e.data?.type === PREVIEW_READY) send();
    }
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  const preview = useMemo<Preview>(
    () => ({
      draft(draft) {
        latest.current = { ...latest.current, ...draft, slides: { ...latest.current.slides, ...draft.slides } };
        send();
      },
      reload: () => setLoads((n) => n + 1),
      open: () => setOpen(true),
    }),
    [],
  );

  const panel = (
    <>
      <div className="preview-views">
        <div role="group" aria-label={m.previewViews} className="segbar">
          {VIEWS.map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {labels[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="phone">
        {/* Keyed instead of a new src, which would add a step to the browser's Back button. */}
        <iframe key={`${view}-${loads}`} ref={frame} src={`/preview/storefront?view=${view}`} title={m.previewTitle} className="phone-screen" />
      </div>
      <p className="hint preview-note">{m.previewNote}</p>
    </>
  );

  return (
    <PreviewContext.Provider value={preview}>
      {head}
      <div className="brand-layout">
        <div className="brand-controls">{children}</div>
        {phone === false && (
          <section aria-labelledby="live-preview-title" className="preview-holder">
            <b id="live-preview-title">{m.previewTitle}</b>
            <p className="hint">{m.previewBuilt}</p>
            {/* One frame at a time: the frame ref and the draft messages follow whichever is showing. */}
            {!open && panel}
          </section>
        )}
        {phone !== null && (
          <Sheet open={open} onClose={() => setOpen(false)} title={m.previewChanges} locale={locale} side={phone ? "bottom" : "end"}>
            {open && panel}
          </Sheet>
        )}
      </div>
    </PreviewContext.Provider>
  );
}

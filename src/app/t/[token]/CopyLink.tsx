"use client";

import { useRef, useState } from "react";

/** The private tracking link with a copy button; selects the text when the clipboard is blocked. */
export function CopyLink({ url, label, hint, copy, copied }: { url: string; label: string; hint: string; copy: string; copied: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [done, setDone] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
    } catch {
      input.current?.select();
    }
  }

  return (
    <section className="sl-order-panel" aria-labelledby="tracking-link-title">
      <h2 id="tracking-link-title">{label}</h2>
      <div className="sl-order-linkline">
        <input ref={input} aria-labelledby="tracking-link-title" readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={onCopy}>
          <span aria-live="polite">{done ? copied : copy}</span>
        </button>
      </div>
      <p className="sl-order-hint">{hint}</p>
    </section>
  );
}

/** Copies the order number; when the clipboard is blocked the button shows the number instead. */
export function CopyNumber({ value, copy, copied }: { value: string; copy: string; copied: string }) {
  const [label, setLabel] = useState(copy);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setLabel(copied);
    } catch {
      setLabel(value);
    }
  }

  return (
    <button type="button" onClick={onCopy}>
      <span aria-live="polite">{label}</span>
    </button>
  );
}

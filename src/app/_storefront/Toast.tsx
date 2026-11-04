"use client";

import { useEffect, useState } from "react";

const EVENT = "sl-toast";
const SHOW_MS = 3600;

/** A short message at the bottom of the screen (quick add, wishlist). ShopFrame holds the one <Toast>. */
export function showToast(text: string) {
  dispatchEvent(new CustomEvent(EVENT, { detail: text }));
}

export function Toast() {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), SHOW_MS);
    };
    addEventListener(EVENT, onToast);
    return () => {
      clearTimeout(timer);
      removeEventListener(EVENT, onToast);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" data-shown={shown} className="sl-flash">
      {text}
    </div>
  );
}

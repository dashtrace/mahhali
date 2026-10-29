"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { Icon } from "./Icon";
import { cx } from "./ui";

const SIDES = {
  // end-auto: the dialog's UA style pins both inline edges, and the viewport's (ltr) direction would then drop the start edge in Arabic.
  start: "inset-y-0 start-0 end-auto h-dvh max-h-none w-[82%] max-w-xs ltr:starting:open:-translate-x-full rtl:starting:open:translate-x-full",
  end: "inset-y-0 start-auto end-0 h-dvh max-h-none w-[82%] max-w-sm ltr:starting:open:translate-x-full rtl:starting:open:-translate-x-full",
  bottom: "inset-x-0 bottom-0 top-auto max-h-[85dvh] w-full max-w-none rounded-t-[20px] starting:open:translate-y-full",
} as const;

/**
 * A slide-in panel (menu drawer, filters). Built on a modal <dialog>, so the
 * browser traps focus, closes on Escape and gives focus back to the opener.
 * Controlled: the parent owns `open` and clears it in `onClose`. Tapping the
 * backdrop or any link inside closes it.
 */
export function Sheet({
  open,
  onClose,
  title,
  locale,
  side = "start",
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  locale: Locale;
  side?: keyof typeof SIDES;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) onClose();
      }}
      className={cx(
        "fixed m-0 overflow-y-auto bg-sl-bg p-0 text-sl-fg shadow-[0_0_24px_#0003] transition-transform duration-300 ease-out backdrop:bg-black/50",
        SIDES[side],
        className,
      )}
    >
      <div className="flex min-h-full flex-col p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="sl-heading min-w-0 truncate text-xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={common[locale].close}
            className="grid size-11 shrink-0 place-items-center rounded-sl border border-sl-border bg-sl-panel"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

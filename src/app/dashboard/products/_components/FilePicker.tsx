"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/Icon";

/** A secondary-button look-alike that opens the file chooser; the input stays focusable for keyboards. */
export function FilePicker({
  children,
  onFile,
  busy,
  accept = "image/png,image/jpeg,image/webp",
  className,
}: {
  children: ReactNode;
  onFile: (file: File) => void;
  busy?: boolean;
  accept?: string;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-sl border border-sl-border bg-sl-panel px-4 text-sm font-bold text-sl-fg hover:border-sl-accent",
        "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-sl-accent",
        busy && "pointer-events-none opacity-45",
        className,
      )}
    >
      <Icon name="plus" />
      {children}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

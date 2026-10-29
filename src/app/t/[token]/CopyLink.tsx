"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, Input } from "@/components/ui";

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
    <Card className="flex flex-col gap-2 rounded-[17px] p-4">
      <label htmlFor="tracking-link" className="text-[13px] font-bold">
        {label}
      </label>
      <div className="flex gap-2">
        <Input ref={input} id="tracking-link" readOnly value={url} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
        <Button tone="outline" onClick={onCopy} className="shrink-0">
          {done && <Icon name="check" className="size-4" />}
          <span aria-live="polite">{done ? copied : copy}</span>
        </Button>
      </div>
      <p className="text-xs leading-normal text-sl-muted">{hint}</p>
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { emailTypo } from "@/server/domain/email";
import { Button, Field, Input } from "./ui";

/**
 * An email field (name="email") that explains itself: an inline message instead of the
 * browser's fading bubble, and "Did you mean …?" with a one-tap fix for a slip in a big
 * provider's domain, which the API refuses (name@gmail.cam).
 */
export function EmailField({ label, hint, required, locale }: { label: ReactNode; hint?: ReactNode; required?: boolean; locale: Locale }) {
  const t = common[locale];
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [shown, setShown] = useState<"invalid" | "typo" | null>(null);
  const fix = emailTypo(value.trim());

  // A typo blocks the submit like any invalid field, so the fix is offered before the order is sent.
  useEffect(() => ref.current?.setCustomValidity(fix ? fill(t.emailTypo, { email: fix }) : ""), [fix, t]);

  return (
    <Field label={label} hint={hint} error={shown === "typo" && fix ? fill(t.emailTypo, { email: fix }) : shown === "invalid" ? t.emailInvalid : undefined}>
      <Input
        ref={ref}
        name="email"
        type="email"
        // The API also wants a dot and a 2+ letter ending, which type="email" alone doesn't check.
        pattern="[^@\s]+@[^@\s]+\.[A-Za-z]{2,}"
        value={value}
        required={required}
        maxLength={200}
        autoComplete="email"
        inputMode="email"
        dir="ltr"
        className="rtl:text-end"
        aria-invalid={shown ? true : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setShown(null);
        }}
        onBlur={() => fix && setShown("typo")}
        onInvalid={(e) => {
          e.preventDefault();
          setShown(fix ? "typo" : "invalid");
          e.currentTarget.focus();
        }}
      />
      {shown === "typo" && fix && (
        <Button
          tone="secondary"
          className="self-start"
          onClick={() => {
            setValue(fix);
            setShown(null);
          }}
        >
          {fill(t.useEmail, { email: fix })}
        </Button>
      )}
    </Field>
  );
}

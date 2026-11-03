"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { passwordProblem } from "@/server/domain/password";
import { Icon } from "./Icon";
import { Field, Input } from "./ui";

/**
 * A password field (name="password") with a show/hide toggle. With `isNew` it also says why
 * a password is too weak (the API refuses those), once 8 characters are typed or the field is left.
 */
export function PasswordField({ label, hint, isNew, locale }: { label: ReactNode; hint?: ReactNode; isNew?: boolean; locale: Locale }) {
  const t = common[locale];
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [touched, setTouched] = useState(false);
  const problem = isNew && value ? passwordProblem(value) : null;
  const message = problem ? t[`password${problem}`] : "";
  const error = problem && (touched || value.length >= 8) ? message : undefined;

  // A weak password blocks the submit like any invalid field.
  useEffect(() => ref.current?.setCustomValidity(message), [message]);

  return (
    <Field label={label} hint={hint} error={error}>
      {/* The input comes first: the label names its first field, not the toggle. */}
      <span className="relative block">
        <Input
          ref={ref}
          name="password"
          type={shown ? "text" : "password"}
          value={value}
          required
          minLength={8}
          maxLength={128}
          autoComplete={isNew ? "new-password" : "current-password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          dir="ltr"
          aria-invalid={error ? true : undefined}
          className="pe-12 rtl:text-end"
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          onInvalid={(e) => {
            if (!problem) return; // empty: the browser's own "fill in this field"
            e.preventDefault();
            setTouched(true);
            e.currentTarget.focus();
          }}
        />
        <button
          type="button"
          aria-pressed={shown}
          aria-label={t.showPassword}
          title={t.showPassword}
          onClick={() => setShown(!shown)}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center text-sl-muted hover:text-sl-fg"
        >
          <Icon name={shown ? "eyeOff" : "eye"} />
        </button>
      </span>
    </Field>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { ArrowOut } from "@/components/Icon";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { ApiError, api, errorMessage } from "@/lib/api";

const MIN = 10;
const MAX = 1000;

/** Shop feedback that may become a public testimonial: needs consent, then the owner's approval. */
export function FeedbackForm({ slug, locale }: { slug: string; locale: Locale }) {
  const m = storeMessages[locale];
  const t = common[locale];
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const short = message.trim().length < MIN;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (short) return setError(m.feedbackTooShort);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/public/shops/${slug}/testimonials`, {
        body: { authorName: String(f.get("authorName") ?? ""), message, consent: f.get("consent") === "on" },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? m.errRateLimited : errorMessage(err, t.error));
    }
    setBusy(false);
  }

  if (sent) return <Alert tone="success">{m.feedbackSent}</Alert>;

  return (
    <form onSubmit={submit} className="sl-form">
      <Field label={m.yourName}>
        <Input name="authorName" required maxLength={60} autoComplete="name" placeholder={m.yourNamePlaceholder} />
      </Field>
      <Field label={m.yourFeedback} hint={fill(m.feedbackCounter, { n: message.length, max: MAX })}>
        <Textarea
          name="message"
          required
          minLength={MIN}
          maxLength={MAX}
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={m.feedbackPlaceholder}
          aria-invalid={!!error && short}
        />
      </Field>
      <label className="sl-consent">
        <input type="checkbox" name="consent" required />
        <span>{m.consent}</span>
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" disabled={busy} className="sl-submit">
        {busy ? m.sending : m.sendFeedback}
        <ArrowOut />
      </Button>
    </form>
  );
}

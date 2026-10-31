"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";

/**
 * A form submit handler. Used instead of the `action` prop, which resets the
 * form even when the API refused it and the person must fix one field.
 */
export const submitWith = (fn: (data: FormData, form: HTMLFormElement) => unknown) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  fn(new FormData(e.currentTarget), e.currentTarget);
};

/**
 * Runs one API mutation with a busy flag and a readable error, then refreshes the page's server data.
 * Busy lasts until the refreshed data has rendered, so a button can't be pressed again on stale values.
 */
export function useAction(fallback: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      startTransition(() => router.refresh());
      return true;
    } catch (e) {
      setError(errorMessage(e, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy: busy || refreshing, error, run };
}

/** A form's fields as one comparable string (a picked file counts by its name). */
const fields = (form: HTMLFormElement) => JSON.stringify([...new FormData(form)].map(([k, v]) => [k, typeof v === "string" ? v : v.name]));

/**
 * An edit form's save: `dirty` once a field differs from what was last saved, `saved` after a
 * save until the next edit, and `save()` sends nothing when nothing changed. Spread `form` on the
 * <form>; pass state that isn't a form field (segmented choices, controlled inputs) as `value`.
 */
export function useSave(fallback: string, value: unknown = null) {
  const action = useAction(fallback);
  const current = JSON.stringify(value);
  const [state, setState] = useState({ base: "", now: "", value: current, saved: false });
  // Stable, so it runs again only when a keyed form remounts with fresh server values.
  const ref = useCallback((form: HTMLFormElement | null) => {
    if (form) {
      const snapshot = fields(form);
      setState((s) => ({ ...s, base: snapshot, now: snapshot }));
    }
  }, []);
  const dirty = state.base !== state.now || state.value !== current;

  async function save(fn: () => Promise<unknown>): Promise<boolean> {
    if (!dirty || action.busy) return false;
    const sent = { now: state.now, value: current };
    const ok = await action.run(fn);
    if (ok) setState((s) => ({ ...s, base: sent.now, value: sent.value, saved: true }));
    return ok;
  }

  return {
    ...action,
    dirty,
    saved: state.saved && !dirty,
    save,
    form: {
      ref,
      onChange: (e: FormEvent<HTMLFormElement>) => {
        const now = fields(e.currentTarget);
        setState((s) => ({ ...s, now }));
      },
    },
  };
}

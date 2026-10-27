"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";

/**
 * A form submit handler. Used instead of the `action` prop, which resets the
 * form even when the API refused it and the person must fix one field.
 */
export const submitWith = (fn: (data: FormData, form: HTMLFormElement) => unknown) => (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  fn(new FormData(e.currentTarget), e.currentTarget);
};

/** Runs one API mutation with a busy flag and a readable error, then refreshes the page's server data. */
export function useAction(fallback: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError(errorMessage(e, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

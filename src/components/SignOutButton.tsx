"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/authClient";
import { cx } from "./ui";

export function SignOutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
      className={cx("inline-flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm text-stone-700 hover:bg-stone-100", className)}
    >
      {label}
    </button>
  );
}

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
      className={cx("inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-muted hover:bg-sl-cat hover:text-sl-fg", className)}
    >
      {label}
    </button>
  );
}

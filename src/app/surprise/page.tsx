import { Countdown } from "./Countdown";

export const dynamic = "force-dynamic";

const DURATION_MS = 5 * 60 * 1000;
// shortcut: in-memory, one shared timer per server process; lost on redeploy/restart. Fine for a one-off pitch.
let startedAt: number | null = null;

export default async function SurprisePage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  let body: React.ReactNode;
  if (reset !== undefined) {
    startedAt = null;
    body = <p className="text-xl">Timer reset. The next person who opens /surprise starts it for everyone.</p>;
  } else {
    startedAt ??= Date.now();
    body = <Countdown remainingMs={Math.max(0, startedAt + DURATION_MS - Date.now())} />;
  }
  return (
    <main dir="ltr" className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-teal-800 to-slate-900 p-6 text-center text-white">
      {body}
    </main>
  );
}

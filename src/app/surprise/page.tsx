"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 5 * 60 * 1000;
const KEY = "surprise-start";
const TEAM = ["Mohammad Ali Alaawar", "Zahraa Salman", "Ali ALhadi mansour"];

export default function SurprisePage() {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    // Kept in localStorage so a refresh doesn't restart the countdown.
    let start = Number(localStorage.getItem(KEY));
    if (!start) {
      start = Date.now();
      localStorage.setItem(KEY, String(start));
    }
    const tick = () => setLeft(Math.max(0, start + DURATION_MS - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  const secs = Math.ceil((left ?? DURATION_MS) / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <main dir="ltr" className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-teal-800 to-slate-900 p-6 text-center text-white">
      {left === 0 ? (
        <div className="max-w-md space-y-6">
          <p className="text-2xl font-semibold">Here is our LinkedIn pages, make sure to follow:</p>
          <ul className="space-y-3">
            {TEAM.map((name) => (
              <li key={name}>
                <a
                  href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl bg-white/10 px-5 py-4 text-lg font-medium hover:bg-white/20"
                >
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg text-teal-100">Something is coming...</p>
          <p className="font-mono text-7xl font-bold tabular-nums">
            {mm}:{ss}
          </p>
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

const TEAM = [
  { name: "Mohammad Ali Alaawar", url: "https://www.linkedin.com/in/mohammad-ali-alaawar/" },
  { name: "Zahraa Salman", url: "https://www.linkedin.com/in/zahraaa-salman" },
  { name: "Ali ALhadi mansour", url: "https://www.linkedin.com/in/alialhadimansour/" },
];

export function Countdown({ remainingMs }: { remainingMs: number }) {
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    // Count from the server's remaining time, so phone clocks don't matter.
    const end = Date.now() + remainingMs;
    const tick = () => setLeft(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [remainingMs]);

  const secs = Math.ceil(left / 1000);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return left === 0 ? (
    <div className="max-w-md space-y-6">
      <p className="text-2xl font-semibold">Here is our LinkedIn pages, make sure to follow:</p>
      <ul className="space-y-3">
        {TEAM.map(({ name, url }) => (
          <li key={name}>
            <a
              href={url}
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
  );
}

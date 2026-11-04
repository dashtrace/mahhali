import type { ReactNode } from "react";

// The dashboard's icon set; sized and stroked by `svg.icon` in dashboard.css.
const SHAPES = {
  orders: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3V1h6v2M9 9h6M9 13h6M9 17h4" />
    </>
  ),
  truck: (
    <>
      <path d="M1 5h13v12H1zM14 9h4l4 4v4h-8z" />
      <circle cx="5" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  box: <path d="m12 2 9 5-9 5-9-5zM3 7v10l9 5 9-5V7M12 12v10" />,
  cash: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <path d="M5 9h1M18 15h1" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M17 14a6 6 0 0 1 5 6" />
    </>
  ),
  chart: <path d="M3 21V3M3 21h18M7 17v-4M12 17V7M17 17v-9" />,
  star: <path d="m12 2 3.1 6.4 7 1-5 4.9 1.2 7-6.3-3.3-6.3 3.3 1.2-7-5-4.9 7-1z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  plan: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M6 15h5" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  plus: <path d="M12 4v16M4 12h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  arrow: <path d="M4 12h16m-7-7 7 7-7 7" />,
  left: <path d="m15 4-8 8 8 8" />,
  check: <path d="m4 12 5 5L20 6" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  warning: <path d="M12 3 2 21h20zM12 9v5M12 18h.01" />,
  copy: (
    <>
      <rect x="7" y="7" width="14" height="14" rx="2" />
      <path d="M16 7V3H5a2 2 0 0 0-2 2v11h4" />
    </>
  ),
  edit: <path d="m4 20 5-.8L20 8a2 2 0 0 0-4-4L5 15z" />,
  archive: (
    <>
      <rect x="3" y="3" width="18" height="5" rx="1" />
      <path d="M5 8v12h14V8M9 13h6" />
    </>
  ),
  home: <path d="m2 11 10-9 10 9v11h-7v-7H9v7H2z" />,
  link: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />,
  grip: (
    <>
      <circle cx="9" cy="5" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="19" r="1" />
    </>
  ),
  up: <path d="m6 14 6-6 6 6" />,
  down: <path d="m6 10 6 6 6-6" />,
  message: <path d="M21 11a9 9 0 0 1-9 9 9.5 9.5 0 0 1-4-.9L3 21l1.9-5A9 9 0 1 1 21 11z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 2v6M17 2v6M3 10h18" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  phone: <path d="M6 2h4l2 5-3 2a16 16 0 0 0 6 6l2-3 5 2v4c-1 5-14 1-18-10C3 5 3 2 6 2" />,
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
  // The platform admin link.
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
} satisfies Record<string, ReactNode>;

export type DashIconName = keyof typeof SHAPES;

const MIRRORED: ReadonlySet<DashIconName> = new Set(["arrow", "left"]);
const SIZES = { md: "", sm: " smicon", tiny: " tinyicon" };

/** Decorative: label the control around it. md 19px, sm 16px, tiny 13px. */
export function DashIcon({ name, size = "md" }: { name: DashIconName; size?: keyof typeof SIZES }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`icon${SIZES[size]}${MIRRORED.has(name) ? " mirror" : ""}`}>
      {SHAPES[name]}
    </svg>
  );
}

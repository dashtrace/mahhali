// Outline icons drawn on a 24px grid, so the app needs no icon package.
// The storefront set follows the shop mockup's SVG object (stroke 1.7, round joins).
const PATHS = {
  orders: "M9 4h6v3H9zM7 5H5v15h14V5h-2M8 11h8M8 15h5",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M18 14c2 .7 3 2.8 3 6",
  cash: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3",
  star: "M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4",
  card: "M3 6h18v12H3zM3 10h18M7 15h3",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  shield: "M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  chat: "M4 5h16v11H8l-4 4z",
  check: "M5 12l5 5 9-10",
  x: "M6 6l12 12M18 6L6 18",
  close: "M6 6l12 12M18 6L6 18",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  bag: "M5 8h14l1 13H4L5 8zM9 9V6a3 3 0 016 0v3",
  menu: "M4 7h16M4 12h16M4 17h16",
  heart: "M20.8 8.7c0 4.5-8.8 10.2-8.8 10.2S3.2 13.2 3.2 8.7a4.8 4.8 0 018.8-2.5 4.8 4.8 0 018.8 2.5z",
  home: "M3 10l9-7 9 7v11h-7v-7h-4v7H3z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  cart: "M2 3h2l3 13h13l2-10H5M8 21h.01M18 21h.01",
  arrow: "M4 12h16M14 6l6 6-6 6",
  arrowBack: "M20 12H4M10 6l-6 6 6 6",
  arrowOut: "M6 18L18 6M8 6h10v10",
  back: "M15 18l-6-6 6-6",
  next: "M9 18l6-6-6-6",
  pause: "M9 5v14M15 5v14",
  play: "M8 5l11 7-11 7z",
  chevron: "M6 9l6 6 6-6",
  sliders: "M4 7h16M4 17h16M8 4v6M16 14v6M6 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M14 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM7 3v4M17 3v4M3 10h18",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  whatsapp: "M3.5 20.5l1.3-4A8.5 8.5 0 1 1 8 19.3zM9 8.6c.2 2.9 3.4 6.1 6.4 6.4l1.1-1.4-1.9-1-1 .7c-1-.4-2-1.4-2.4-2.4l.7-1-1-1.9z",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M17.5 6.5h.01",
  facebook: "M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v4H8v7h4v-7h2.6l.9-4H12V8a1 1 0 0 1 1-1h2z",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-2.6 3.3M6.6 7.6C3.8 9.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.7-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2",
} as const;

export type IconName = keyof typeof PATHS;

// Icons that point along the reading direction flip in Arabic.
const MIRRORED: ReadonlySet<IconName> = new Set(["arrow", "arrowBack", "arrowOut", "back", "next"]);

/** `solid` fills the shape (active tab, saved heart). Decorative: label the control around it. */
export function Icon({ name, className = "size-5", solid }: { name: IconName; className?: string; solid?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={solid ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={MIRRORED.has(name) ? `[&:dir(rtl)]:-scale-x-100 ${className}` /* :dir() honours a nested dir="ltr"; rtl: does not */ : className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

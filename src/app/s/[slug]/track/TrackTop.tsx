import type { CheckoutMessages } from "@/i18n/messages/checkout";
import { TrackForm } from "./TrackForm";

/** The Track page's opening: heading, form and aside. The order's result appears below it. */
export function TrackTop({ slug, shopName, number, m }: { slug: string; shopName: string; number?: number; m: CheckoutMessages }) {
  return (
    <div className="sl-track-top">
      <div>
        <p className="sl-page-eyebrow">{m.trackEyebrow}</p>
        <h1 className="sl-page-title sl-track-title">
          {m.trackTitle}
          <span className="sl-dot">.</span>
        </h1>
        <p className="sl-track-intro">{m.trackLead}</p>
        <TrackForm slug={slug} number={number} m={m} />
      </div>
      <aside className="sl-track-aside sl-on-surface">
        <div className="sl-track-mark" aria-hidden>
          ✦
        </div>
        <p className="sl-track-shop">{shopName}</p>
        <h2>
          {m.trackAsideLine1}
          <br />
          {m.trackAsideLine2}
        </h2>
        <p>{m.trackAsideBody}</p>
        <ol className="sl-track-points">
          {[m.trackPoint1, m.trackPoint2, m.trackPoint3].map((point, i) => (
            <li key={point}>
              0{i + 1} <b>{point}</b>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}

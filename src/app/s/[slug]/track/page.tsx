import type { Metadata } from "next";
import { checkoutMessages } from "@/i18n/messages/checkout";
import { loadCatalogue } from "../../../_storefront/data";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { TrackForm } from "./TrackForm";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadCatalogue((await params).slug);
  return { title: `${checkoutMessages[shop.locale].trackTitle} · ${shop.name}` };
}

export default async function TrackPage({ params }: Params) {
  const { slug } = await params;
  const { shop } = await loadCatalogue(slug);
  const m = checkoutMessages[shop.locale];
  return (
    <ShopFrame shop={shop} locale={shop.locale} page="sl-track-page">
      <div className="sl-track-top">
        <div>
          <p className="sl-page-eyebrow">{m.trackEyebrow}</p>
          <h1 className="sl-page-title sl-track-title">
            {m.trackTitle}
            <span className="sl-dot">.</span>
          </h1>
          <p className="sl-track-intro">{m.trackLead}</p>
          <TrackForm slug={slug} m={m} />
        </div>
        <aside className="sl-track-aside sl-on-surface">
          <div className="sl-track-mark" aria-hidden>
            ✦
          </div>
          <p className="sl-track-shop">{shop.name}</p>
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
    </ShopFrame>
  );
}

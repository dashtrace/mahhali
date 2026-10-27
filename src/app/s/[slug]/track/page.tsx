import type { Metadata } from "next";
import { Card } from "@/components/ui";
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
    <ShopFrame shop={shop} locale={shop.locale}>
      <div className="mx-auto max-w-md py-2">
        <h1 className="sl-heading text-[29px] leading-tight">{m.trackTitle}</h1>
        <p className="mt-1.5 text-sm leading-normal text-sl-muted">{m.trackLead}</p>
        <Card className="mt-4 rounded-[17px] p-4 shadow-[0_7px_20px_#00000005]">
          <TrackForm slug={slug} m={m} />
        </Card>
        <p className="mt-3 text-xs leading-normal text-sl-muted">{m.trackHint}</p>
      </div>
    </ShopFrame>
  );
}

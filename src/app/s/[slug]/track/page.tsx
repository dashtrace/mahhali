import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { loadCatalogue } from "../../../_storefront/data";
import { ShopFrame } from "../../../_storefront/ShopFrame";
import { TrackForm } from "./TrackForm";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { shop } = await loadCatalogue((await params).slug);
  return { title: `${storeMessages[shop.locale].trackTitle} · ${shop.name}` };
}

export default async function TrackPage({ params }: Params) {
  const { slug } = await params;
  const { shop } = await loadCatalogue(slug);
  const m = storeMessages[shop.locale];
  return (
    <ShopFrame shop={shop} locale={shop.locale} cart>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold">{m.trackTitle}</h1>
        <p className="mb-4 mt-1 text-sm opacity-70">{m.trackLead}</p>
        <Card>
          <TrackForm slug={slug} m={m} t={common[shop.locale]} />
        </Card>
      </div>
    </ShopFrame>
  );
}

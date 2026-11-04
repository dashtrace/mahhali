import { isLocale, type Locale } from "@/i18n/locale";

// The settings page and the preview frame talk over postMessage: the frame says
// it is ready, the page answers with everything unsaved so far.

export const PREVIEW_READY = "sl-preview-ready";
export const PREVIEW_DRAFT = "sl-preview-draft";
/** The key of a slide being added, which has no id until it is saved. */
export const NEW_SLIDE = "new";

type Slide = { id: string; imageUrl: string; kicker: string | null; title: string; body: string | null };

export type PreviewDraft = {
  theme?: unknown;
  name?: string;
  language?: string;
  tagline?: string;
  logoMode?: string;
  homeSection?: string;
  homeCategoryId?: string | null;
  showTestimonials?: boolean;
  about?: string;
  shippingInfo?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  whatsappPhone?: string | null;
  /** Edits by slide id; a null or absent NEW_SLIDE means no slide is being added. */
  slides?: Record<string, Partial<Slide> | null>;
  /** The slide being edited, shown so the edit is visible. */
  focus?: number;
};

/** The saved shop with the unsaved edits on top. ShopFrame passes the theme through readTheme and themeVars, as on the published storefront. */
export function applyDraft<S extends { slides: Slide[]; locale: Locale }>(shop: S, { slides = {}, language, ...fields }: PreviewDraft) {
  const added = slides[NEW_SLIDE];
  return {
    ...shop,
    ...fields,
    locale: isLocale(language) ? language : shop.locale,
    slides: [...shop.slides.map((s) => ({ ...s, ...slides[s.id] })), ...(added ? [{ kicker: null, title: "", body: null, imageUrl: "", ...added, id: NEW_SLIDE }] : [])],
  } as S;
}

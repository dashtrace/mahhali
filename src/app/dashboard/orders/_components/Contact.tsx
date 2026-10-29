import { Icon } from "@/components/Icon";
import { cx } from "@/components/ui";
import { whatsappLink } from "@/lib/format";

const button =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sl border border-sl-border bg-sl-panel px-4 text-sm font-bold text-sl-fg hover:border-sl-accent";

/** Call and WhatsApp the customer in one tap. */
export function ContactButtons({ phone, call, whatsapp, className }: { phone: string; call: string; whatsapp: string; className?: string }) {
  return (
    <div className={cx("flex gap-2", className)}>
      <a href={`tel:${phone}`} className={button}>
        <Icon name="phone" className="size-[18px] text-sl-accent" />
        {call}
      </a>
      <a href={whatsappLink(phone)} target="_blank" rel="noopener noreferrer" className={button}>
        <Icon name="whatsapp" className="size-[18px] text-sl-whatsapp" />
        {whatsapp}
      </a>
    </div>
  );
}

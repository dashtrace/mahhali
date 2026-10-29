import { Icon } from "@/components/Icon";

/** The customer's customization text on an order line (the storefront cart-note look). */
export function ItemNote({ label, note }: { label: string; note: string }) {
  return (
    <p className="mt-1.5 whitespace-pre-wrap break-words rounded-[5px] border-s-[3px] border-sl-accent bg-sl-cat px-2.5 py-1.5 text-xs leading-relaxed">
      <span className="font-bold">{label}: </span>
      {note}
    </p>
  );
}

/** The landmark callout couriers look for first. */
export function Landmark({ label, text }: { label: string; text: string }) {
  return (
    <p className="mt-2 flex gap-2 rounded-sl bg-sl-cat px-3 py-2 text-sm">
      <Icon name="pin" className="mt-0.5 size-4 shrink-0 text-sl-accent" />
      <span>
        <span className="font-bold">{label}:</span> {text}
      </span>
    </p>
  );
}

import { Button, Field, Input } from "@/components/ui";
import { PeriodQuery } from "@/server/validation/money";

/** ?from=&to= from the URL; an invalid range falls back to the last 30 days. */
export function readPeriod(sp: { from?: string; to?: string }) {
  const parsed = PeriodQuery.safeParse({ from: sp.from || undefined, to: sp.to || undefined });
  return parsed.success ? parsed.data : {};
}

/** A plain GET form, so the range lives in the URL and works without JavaScript. */
export function PeriodForm({ from, to, labels }: { from: string; to: string; labels: { from: string; to: string; apply: string } }) {
  return (
    <form className="mb-4 grid grid-cols-2 items-end gap-2.5 rounded-sl-lg border border-sl-border bg-sl-panel p-3 shadow-[0_2px_10px_#00000006] sm:flex">
      <Field label={labels.from} className="sm:flex-1">
        <Input type="date" name="from" defaultValue={from} />
      </Field>
      <Field label={labels.to} className="sm:flex-1">
        <Input type="date" name="to" defaultValue={to} />
      </Field>
      <Button type="submit" tone="outline" className="col-span-2 sm:px-6">
        {labels.apply}
      </Button>
    </form>
  );
}

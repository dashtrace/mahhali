// Money is always an integer: USD in cents, LBP in whole pounds.
// Exchange rates are pounds per dollar with two decimals, e.g. "89500.00".
export type Currency = "USD" | "LBP";

const DECIMALS: Record<Currency, number> = { USD: 2, LBP: 0 };

/** "12.5" in USD -> 1250n; "450000" in LBP -> 450000n. Throws on bad input. */
export function toMinor(amount: string, currency: Currency): bigint {
  const decimals = DECIMALS[currency];
  const pattern = decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`);
  const trimmed = amount.trim().replace(/,/g, "");
  if (!pattern.test(trimmed)) throw new RangeError(`Invalid ${currency} amount: ${amount}`);
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole + frac.padEnd(decimals, "0"));
}

/** 1250n in USD -> "12.50"; 450000n in LBP -> "450000". */
export function fromMinor(minor: bigint, currency: Currency): string {
  const decimals = DECIMALS[currency];
  if (decimals === 0) return minor.toString();
  const sign = minor < 0n ? "-" : "";
  const abs = (minor < 0n ? -minor : minor).toString().padStart(decimals + 1, "0");
  return `${sign}${abs.slice(0, -decimals)}.${abs.slice(-decimals)}`;
}

/** "89500.00" -> 8950000n (hundredths of a pound per dollar). */
export function rateToHundredths(rate: string): bigint {
  const minor = toMinor(rate, "USD");
  if (minor <= 0n) throw new RangeError("Exchange rate must be positive");
  return minor;
}

function divRound(numerator: bigint, denominator: bigint): bigint {
  // Half up, for non-negative numerator and positive denominator.
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/**
 * Cash collected in dollars and pounds, expressed in the order's currency
 * using the rate frozen on the order.
 */
export function collectedInOrderCurrency(
  collected: { usdCents: bigint; lbp: bigint },
  orderCurrency: Currency,
  rate: string | null,
): bigint {
  if (collected.usdCents < 0n || collected.lbp < 0n) throw new RangeError("Negative cash");
  if (orderCurrency === "USD") {
    if (collected.lbp === 0n) return collected.usdCents;
    if (!rate) throw new RangeError("An exchange rate is needed to convert pounds");
    // lbp / (hundredths / 100) dollars = lbp * 100 * 100 / hundredths cents
    return collected.usdCents + divRound(collected.lbp * 10_000n, rateToHundredths(rate));
  }
  if (collected.usdCents === 0n) return collected.lbp;
  if (!rate) throw new RangeError("An exchange rate is needed to convert dollars");
  return collected.lbp + divRound(collected.usdCents * rateToHundredths(rate), 10_000n);
}

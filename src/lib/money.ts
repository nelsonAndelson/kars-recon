/** All arithmetic uses integer cents and hundredths of hours. Round each job half-up. */
function integer(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Expected nonnegative integer cents");
  return BigInt(value);
}
function safe(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < 0n)
    throw new Error("Amount out of range");
  return Number(value);
}
export function hoursToHundredths(hours: string): bigint {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(hours))
    throw new Error("Hours must have at most two decimals");
  const [whole, fraction = ""] = hours.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function laborCents(
  hours: string,
  rateCents: number,
  comeback = false,
): number {
  const hundredths = hoursToHundredths(hours);
  const rate = integer(rateCents);
  return comeback ? 0 : safe((hundredths * rate + 50n) / 100n);
}
export function partNetCents(part: {
  qty: number;
  unit_cost_cents: number;
  core_charge_cents: number;
  refund_cents: number;
  core_refund_cents: number;
}): number {
  const qty = integer(part.qty);
  if (qty === 0n) throw new Error("Quantity must be positive");
  // Core charge/refunds are line totals, not per-unit values.
  const gross =
    qty * integer(part.unit_cost_cents) + integer(part.core_charge_cents);
  return safe(
    gross - integer(part.refund_cents) - integer(part.core_refund_cents),
  );
}
export function totalCents(amounts: number[]): number {
  return safe(amounts.reduce((sum, amount) => sum + integer(amount), 0n));
}
export function formatMoney(cents: number): string {
  const amount = integer(cents);
  return `$${(amount / 100n).toLocaleString("en-US")}.${(amount % 100n).toString().padStart(2, "0")}`;
}
export function budgetState(
  spent: number,
  budget: number,
  warningPct = 80,
): "normal" | "warning" | "over" {
  const s = integer(spent),
    b = integer(budget),
    pct = integer(warningPct);
  if (pct > 100n) throw new Error("Warning percent cannot exceed 100");
  if (s > b) return "over";
  return b > 0n && s * 100n >= b * pct ? "warning" : "normal";
}
export function effectiveRate(
  rates: { effective_from: string; rate_cents_per_hour: number }[],
  completedDate: string,
): number {
  const eligible = rates
    .filter((rate) => rate.effective_from <= completedDate)
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
  if (!eligible.length)
    throw new Error("No pay rate exists for the completion date");
  integer(eligible[0].rate_cents_per_hour);
  return eligible[0].rate_cents_per_hour;
}

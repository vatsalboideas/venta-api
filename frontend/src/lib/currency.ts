const INR_CURRENCY_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_CURRENCY_FORMATTER_WITH_PAISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInrCurrency(value: number | string | null | undefined, withPaise = false) {
  const normalized = Number(value ?? 0);
  const formatter = withPaise ? INR_CURRENCY_FORMATTER_WITH_PAISE : INR_CURRENCY_FORMATTER;
  return formatter.format(Number.isFinite(normalized) ? normalized : 0);
}

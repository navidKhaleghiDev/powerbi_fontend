/** Preserve decimal precision in KPI text; chart coordinates may still use numbers. */
export const formatExactValue = (
  input: string | number | null | undefined,
  locale: string,
): string => {
  const text = String(input ?? "");
  if (!/^-?\d+([.]\d+)?$/.test(text)) return text;
  const [whole, fraction] = text.split(".");
  let grouped = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(BigInt(whole));
  if (whole === "-0")
    grouped =
      (new Intl.NumberFormat(locale)
        .formatToParts(-1)
        .find((part) => part.type === "minusSign")?.value || "-") + grouped;
  if (!fraction) return grouped;
  const decimal =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === "decimal")?.value || ".";
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  return (
    grouped +
    decimal +
    [...fraction].map((value) => digits.format(Number(value))).join("")
  );
};

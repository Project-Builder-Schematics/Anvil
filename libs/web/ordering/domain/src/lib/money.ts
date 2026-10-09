/** `amount` is in the currency's minor units. */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export const formatMoney = ({ amount, currency }: Money): string => {
  const format = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
};

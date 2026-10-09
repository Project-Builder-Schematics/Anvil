export interface StockLevel {
  readonly productId: string;
  readonly onHand: number;
  readonly reserved: number;
}

/** Rule I1. */
export const availableOf = ({ onHand, reserved }: StockLevel): number =>
  onHand - reserved;

/** Rule I6: the level that can be set is an integer of 0 or more. */
export const isOnHand = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

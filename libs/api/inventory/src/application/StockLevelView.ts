import type { StockItem } from '../domain/StockItem';

export interface StockLevelView {
  readonly productId: string;
  readonly onHand: number;
  readonly reserved: number;
}

export const toView = ({
  productId,
  onHand,
  reserved,
}: StockItem): StockLevelView => ({ productId, onHand, reserved });

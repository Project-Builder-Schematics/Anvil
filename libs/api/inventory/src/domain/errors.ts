export const INVENTORY_ERROR = {
  INSUFFICIENT_STOCK: 'inventory.insufficient_stock',
  PRODUCT_NOT_STOCKED: 'inventory.product_not_stocked',
  STOCK_LEVEL_INVALID: 'inventory.stock_level_invalid',
} as const;

export type InventoryErrorCode = keyof typeof INVENTORY_ERROR;

export class InventoryError extends Error {
  constructor(readonly code: InventoryErrorCode) {
    super(INVENTORY_ERROR[code]);
    this.name = 'InventoryError';
  }
}

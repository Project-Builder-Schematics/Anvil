import { StockItem } from './StockItem';
import { StockLevel } from './StockLevel';

const item = (onHand: number, reserved = 0) =>
  StockItem.create('keyboard', StockLevel.of(onHand)).reserve(reserved);

const refused = (code: string): unknown =>
  expect.objectContaining({ name: 'InventoryError', code });

describe('StockItem', () => {
  it('starts with nothing reserved', () => {
    const created = StockItem.create('keyboard', StockLevel.of(10));
    expect(created).toMatchObject({
      productId: 'keyboard',
      onHand: 10,
      reserved: 0,
    });
  });

  describe('reserve', () => {
    it('adds to the reserved count', () => {
      expect(item(10, 3).reserve(2)).toMatchObject({ onHand: 10, reserved: 5 });
    });

    it('accepts exactly what is available', () => {
      expect(item(10, 3).reserve(7)).toMatchObject({ reserved: 10 });
    });

    it('refuses more than is available with INSUFFICIENT_STOCK', () => {
      expect(() => item(10, 3).reserve(8)).toThrow(
        refused('INSUFFICIENT_STOCK'),
      );
    });

    it('does not change the item it is called on', () => {
      const before = item(10, 3);
      before.reserve(2);
      expect(before.reserved).toBe(3);
    });
  });

  it('release returns the quantity to available', () => {
    expect(item(10, 5).release(2)).toMatchObject({ onHand: 10, reserved: 3 });
  });

  it('commit lowers onHand and reserved by the quantity', () => {
    expect(item(10, 5).commit(2)).toMatchObject({ onHand: 8, reserved: 3 });
  });

  describe('setLevel', () => {
    it('replaces onHand and keeps reserved', () => {
      expect(item(10, 4).setLevel(StockLevel.of(25))).toMatchObject({
        onHand: 25,
        reserved: 4,
      });
    });

    it('accepts a level equal to the reserved count', () => {
      expect(item(10, 4).setLevel(StockLevel.of(4))).toMatchObject({
        onHand: 4,
      });
    });

    it('refuses a level below the reserved count with STOCK_LEVEL_INVALID', () => {
      expect(() => item(10, 4).setLevel(StockLevel.of(3))).toThrow(
        refused('STOCK_LEVEL_INVALID'),
      );
    });
  });
});

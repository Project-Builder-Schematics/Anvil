import { StockItem } from '../domain/StockItem';
import { StockLevel } from '../domain/StockLevel';
import { MemoryStockItems } from './MemoryStockItems';

const item = (productId: string, onHand: number) =>
  StockItem.create(productId, StockLevel.of(onHand));

describe('MemoryStockItems (StockItems contract)', () => {
  it('answers null for a product that was never saved', async () => {
    expect(await new MemoryStockItems().byId('ghost')).toBeNull();
  });

  it('answers what save stored under that product', async () => {
    const stockItems = new MemoryStockItems();
    const lamp = item('lamp', 3);
    await stockItems.save(lamp);
    expect(await stockItems.byId('lamp')).toBe(lamp);
  });

  it('replaces the item saved under the same product', async () => {
    const stockItems = new MemoryStockItems();
    await stockItems.save(item('lamp', 3));
    const more = item('lamp', 8);
    await stockItems.save(more);
    expect(await stockItems.byId('lamp')).toBe(more);
  });

  it.each(['keyboard', 'mouse', 'monitor'])(
    'knows the demo product %s with nothing reserved',
    async (productId) => {
      expect(await new MemoryStockItems().byId(productId)).toMatchObject({
        productId,
        onHand: 50,
        reserved: 0,
      });
    },
  );
});

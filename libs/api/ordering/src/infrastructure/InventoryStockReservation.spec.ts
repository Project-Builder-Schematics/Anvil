import type {
  CommitStock,
  ReleaseStock,
  ReserveStock,
} from '@demo/api-inventory';
import { Money } from '../domain/Money';
import { OrderId } from '../domain/OrderId';
import { ProductId } from '../domain/ProductId';
import { Quantity } from '../domain/Quantity';
import { InventoryStockReservation } from './InventoryStockReservation';

const id = OrderId.of('o1');
const lines = [
  {
    productId: ProductId.of('keyboard'),
    quantity: Quantity.of(3),
    unitPrice: Money.of(4500, 'USD'),
  },
];

const refusal = (code: string) => Object.assign(new Error(code), { code });

const adapter = (reserve: ReserveStock = () => Promise.reject(new Error())) => {
  const release = vi.fn<ReleaseStock>(() => Promise.resolve({ orderId: 'o1' }));
  const commit = vi.fn<CommitStock>(() => Promise.resolve({ orderId: 'o1' }));
  return {
    release,
    commit,
    stock: new InventoryStockReservation(reserve, release, commit),
  };
};

describe('InventoryStockReservation', () => {
  it('reserves the lines of the order in inventory terms', async () => {
    const reserve = vi.fn<ReserveStock>((command) =>
      Promise.resolve({ orderId: command.orderId, lines: command.lines }),
    );

    const outcome = await adapter(reserve).stock.reserve(id, lines);

    expect(outcome).toBe('Reserved');
    expect(reserve).toHaveBeenCalledWith({
      orderId: 'o1',
      lines: [{ productId: 'keyboard', quantity: 3 }],
    });
  });

  it.each(['INSUFFICIENT_STOCK', 'PRODUCT_NOT_STOCKED'])(
    'answers OutOfStock when inventory refuses with %s',
    async (code) => {
      const { stock } = adapter(() => Promise.reject(refusal(code)));
      expect(await stock.reserve(id, lines)).toBe('OutOfStock');
    },
  );

  it.each([
    ['another refusal', refusal('STOCK_LEVEL_INVALID')],
    ['a failure without a code', new Error('down')],
  ])('lets %s through', async (_name, error) => {
    const { stock } = adapter(() => Promise.reject(error));
    await expect(stock.reserve(id, lines)).rejects.toBe(error);
  });

  it('releases and commits by order id', async () => {
    const { stock, release, commit } = adapter();

    await stock.release(id);
    await stock.commit(id);

    expect(release).toHaveBeenCalledWith({ orderId: 'o1' });
    expect(commit).toHaveBeenCalledWith({ orderId: 'o1' });
  });
});

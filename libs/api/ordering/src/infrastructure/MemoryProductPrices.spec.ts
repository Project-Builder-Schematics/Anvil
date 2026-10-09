import { Money } from '../domain/Money';
import { ProductId } from '../domain/ProductId';
import { MemoryProductPrices } from './MemoryProductPrices';

describe('MemoryProductPrices (ProductPrices contract)', () => {
  it('answers null for an unknown product', async () => {
    expect(
      await new MemoryProductPrices().priceOf(ProductId.of('ghost')),
    ).toBeNull();
  });

  it('answers the price a product was set to', async () => {
    const prices = new MemoryProductPrices();
    prices.set(ProductId.of('lamp'), Money.of(1200, 'EUR'));
    expect(await prices.priceOf(ProductId.of('lamp'))).toEqual(
      Money.of(1200, 'EUR'),
    );
  });

  it('answers the latest price after a change', async () => {
    const prices = new MemoryProductPrices();
    prices.set(ProductId.of('lamp'), Money.of(1200, 'EUR'));
    prices.set(ProductId.of('lamp'), Money.of(1500, 'EUR'));
    expect(await prices.priceOf(ProductId.of('lamp'))).toEqual(
      Money.of(1500, 'EUR'),
    );
  });

  it('knows the demo products', async () => {
    const prices = new MemoryProductPrices();
    expect(await prices.priceOf(ProductId.of('keyboard'))).toEqual(
      Money.of(4500, 'USD'),
    );
    expect(await prices.priceOf(ProductId.of('mouse'))).toEqual(
      Money.of(2500, 'USD'),
    );
    expect(await prices.priceOf(ProductId.of('monitor'))).toEqual(
      Money.of(21900, 'USD'),
    );
  });
});

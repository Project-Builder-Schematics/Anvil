import { ProductId } from './ProductId';

describe('ProductId', () => {
  it('keeps its value', () => {
    expect(ProductId.of('keyboard').value).toBe('keyboard');
  });

  it.each(['', ' ', '\t\n'])('refuses the blank id %j', (value) => {
    expect(() => ProductId.of(value)).toThrow(
      new RangeError('ProductId must not be blank'),
    );
  });

  it('equals an id with the same value only', () => {
    expect(ProductId.of('a').equals(ProductId.of('a'))).toBe(true);
    expect(ProductId.of('a').equals(ProductId.of('b'))).toBe(false);
  });
});

import { OrderId } from './OrderId';

describe('OrderId', () => {
  it('keeps its value', () => {
    expect(OrderId.of('ord-1').value).toBe('ord-1');
  });

  it.each(['', ' ', '\t\n'])('refuses the blank id %j', (value) => {
    expect(() => OrderId.of(value)).toThrow(RangeError);
  });
});

export class OrderId {
  private constructor(readonly value: string) {}

  static of(value: string): OrderId {
    if (value.trim() === '') throw new RangeError('OrderId must not be blank');
    return new OrderId(value);
  }
}

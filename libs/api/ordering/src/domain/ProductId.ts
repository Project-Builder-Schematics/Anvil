export class ProductId {
  private constructor(readonly value: string) {}

  static of(value: string): ProductId {
    if (value.trim() === '')
      throw new RangeError('ProductId must not be blank');
    return new ProductId(value);
  }

  equals(other: ProductId): boolean {
    return this.value === other.value;
  }
}

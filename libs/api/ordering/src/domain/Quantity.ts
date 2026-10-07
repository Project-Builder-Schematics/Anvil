import { OrderingError } from './errors';

const MIN = 1;
const MAX = 99;

export class Quantity {
  private constructor(readonly value: number) {}

  static of(value: number): Quantity {
    if (!Number.isInteger(value) || value < MIN || value > MAX)
      throw new OrderingError('QUANTITY_OUT_OF_RANGE');
    return new Quantity(value);
  }

  add(other: Quantity): Quantity {
    return Quantity.of(this.value + other.value);
  }
}

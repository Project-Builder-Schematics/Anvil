import type { Money } from '../Money';
import type { OrderId } from '../OrderId';

export interface Charges {
  charge(
    orderId: OrderId,
    total: Money,
    paymentMethodToken: string,
  ): Promise<'Captured' | 'Declined'>;
}

export const CHARGES = Symbol('Charges');

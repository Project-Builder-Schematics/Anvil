import type { OrderEvent } from '../events';

export interface DomainEvents {
  publish(event: OrderEvent): Promise<void>;
}

export const DOMAIN_EVENTS = Symbol('DomainEvents');

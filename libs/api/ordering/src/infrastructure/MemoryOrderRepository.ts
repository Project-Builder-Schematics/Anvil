import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Order } from '../domain/Order';
import { OrderId } from '../domain/OrderId';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

@Injectable()
export class MemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  nextId(): OrderId {
    return OrderId.of(randomUUID());
  }

  byId(id: OrderId): Promise<Order | null> {
    return Promise.resolve(this.orders.get(id.value) ?? null);
  }

  save(order: Order): Promise<void> {
    this.orders.set(order.id.value, order);
    return Promise.resolve();
  }
}

import { Injectable } from '@nestjs/common';
import type { OrderEvent } from '../domain/events';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';

@Injectable()
export class MemoryDomainEvents implements DomainEvents {
  readonly published: OrderEvent[] = [];

  publish(event: OrderEvent): Promise<void> {
    this.published.push(event);
    return Promise.resolve();
  }
}

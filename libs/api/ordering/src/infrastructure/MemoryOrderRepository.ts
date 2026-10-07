import { Injectable } from '@nestjs/common';
import type { OrderRepository } from '../domain/driven-ports/OrderRepository';

@Injectable()
export class MemoryOrderRepository implements OrderRepository {}

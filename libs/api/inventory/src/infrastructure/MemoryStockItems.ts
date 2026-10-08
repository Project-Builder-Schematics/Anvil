import { Injectable } from '@nestjs/common';
import type { StockItems } from '../domain/driven-ports/StockItems';

@Injectable()
export class MemoryStockItems implements StockItems {}

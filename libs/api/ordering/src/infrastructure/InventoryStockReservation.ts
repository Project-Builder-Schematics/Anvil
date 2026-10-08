import { Injectable } from '@nestjs/common';
import type * as inventory from '@demo/api-inventory';
import type { StockReservation } from '../domain/driven-ports/StockReservation';

// Translates this port into inventory's language: the only file of the slice that knows its barrel.
export type InventoryApi = typeof inventory;

@Injectable()
export class InventoryStockReservation implements StockReservation {}

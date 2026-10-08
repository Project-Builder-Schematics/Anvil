import { Module } from '@nestjs/common';
import { STOCK_ITEMS } from './domain/driven-ports/StockItems';
import { MemoryStockItems } from './infrastructure/MemoryStockItems';
import { RESERVATIONS } from './domain/driven-ports/Reservations';
import { MemoryReservations } from './infrastructure/MemoryReservations';
import { RESERVE_STOCK, makeReserveStock } from './application/ReserveStock';
import { RELEASE_STOCK, makeReleaseStock } from './application/ReleaseStock';
import { COMMIT_STOCK, makeCommitStock } from './application/CommitStock';
import {
  SET_STOCK_LEVEL,
  makeSetStockLevel,
} from './application/SetStockLevel';
import {
  GET_STOCK_LEVEL,
  makeGetStockLevel,
} from './application/GetStockLevel';
import { StockController } from './infrastructure/http/stock.controller';

@Module({
  controllers: [StockController],
  providers: [
    { provide: STOCK_ITEMS, useClass: MemoryStockItems },
    { provide: RESERVATIONS, useClass: MemoryReservations },
    {
      provide: RESERVE_STOCK,
      useFactory: makeReserveStock,
      inject: [STOCK_ITEMS, RESERVATIONS],
    },
    {
      provide: RELEASE_STOCK,
      useFactory: makeReleaseStock,
      inject: [STOCK_ITEMS, RESERVATIONS],
    },
    {
      provide: COMMIT_STOCK,
      useFactory: makeCommitStock,
      inject: [STOCK_ITEMS, RESERVATIONS],
    },
    {
      provide: SET_STOCK_LEVEL,
      useFactory: makeSetStockLevel,
      inject: [STOCK_ITEMS],
    },
    {
      provide: GET_STOCK_LEVEL,
      useFactory: makeGetStockLevel,
      inject: [STOCK_ITEMS],
    },
  ],
  exports: [
    RESERVE_STOCK,
    RELEASE_STOCK,
    COMMIT_STOCK,
    SET_STOCK_LEVEL,
    GET_STOCK_LEVEL,
  ],
})
export class InventoryModule {}

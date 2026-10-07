import { Module } from '@nestjs/common';
import { ORDER_REPOSITORY } from './domain/driven-ports/OrderRepository';
import { MemoryOrderRepository } from './infrastructure/MemoryOrderRepository';
import { PRODUCT_PRICES } from './domain/driven-ports/ProductPrices';
import { MemoryProductPrices } from './infrastructure/MemoryProductPrices';
import { CREATE_ORDER, makeCreateOrder } from './application/CreateOrder';
import { ADD_ORDER_LINE, makeAddOrderLine } from './application/AddOrderLine';
import { PLACE_ORDER, makePlaceOrder } from './application/PlaceOrder';
import { CANCEL_ORDER, makeCancelOrder } from './application/CancelOrder';
import { GET_ORDER, makeGetOrder } from './application/GetOrder';
import { OrdersController } from './infrastructure/http/orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [
    { provide: ORDER_REPOSITORY, useClass: MemoryOrderRepository },
    { provide: PRODUCT_PRICES, useClass: MemoryProductPrices },
    {
      provide: CREATE_ORDER,
      useFactory: makeCreateOrder,
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: ADD_ORDER_LINE,
      useFactory: makeAddOrderLine,
      inject: [ORDER_REPOSITORY, PRODUCT_PRICES],
    },
    {
      provide: PLACE_ORDER,
      useFactory: makePlaceOrder,
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: CANCEL_ORDER,
      useFactory: makeCancelOrder,
      inject: [ORDER_REPOSITORY],
    },
    {
      provide: GET_ORDER,
      useFactory: makeGetOrder,
      inject: [ORDER_REPOSITORY],
    },
  ],
  exports: [CREATE_ORDER, ADD_ORDER_LINE, PLACE_ORDER, CANCEL_ORDER, GET_ORDER],
})
export class OrderingModule {}

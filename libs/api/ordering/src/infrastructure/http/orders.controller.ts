import { z } from 'zod';
import {
  CREATE_ORDER,
  type CreateOrder,
  type CreateOrderResult,
} from '../../application/CreateOrder';
import { OrderingErrorFilter } from './OrderingErrorFilter';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ADD_ORDER_LINE,
  type AddOrderLine,
  type AddOrderLineResult,
} from '../../application/AddOrderLine';
import {
  PLACE_ORDER,
  type PlaceOrder,
  type PlaceOrderResult,
} from '../../application/PlaceOrder';
import {
  CANCEL_ORDER,
  type CancelOrder,
  type CancelOrderResult,
} from '../../application/CancelOrder';
import {
  GET_ORDER,
  type GetOrder,
  type GetOrderResult,
} from '../../application/GetOrder';

const createOrderBody = z.object({}).default({});

const addOrderLineParams = z.object({ orderId: z.string().trim().min(1) });
const addOrderLineBody = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number(),
});

const placeOrderParams = z.object({ orderId: z.string().trim().min(1) });
const placeOrderBody = z.object({
  paymentMethodToken: z.string().trim().min(1),
});

const cancelOrderParams = z.object({ orderId: z.string().trim().min(1) });
const cancelOrderBody = z.object({}).default({});

const getOrderParams = z.object({ orderId: z.string().trim().min(1) });
const getOrderQuery = z.object({});

@Controller('orders')
@UseFilters(OrderingErrorFilter)
export class OrdersController {
  constructor(
    @Inject(CREATE_ORDER) private readonly createOrderUseCase: CreateOrder,
    @Inject(ADD_ORDER_LINE) private readonly addOrderLineUseCase: AddOrderLine,
    @Inject(PLACE_ORDER) private readonly placeOrderUseCase: PlaceOrder,
    @Inject(CANCEL_ORDER) private readonly cancelOrderUseCase: CancelOrder,
    @Inject(GET_ORDER) private readonly getOrderUseCase: GetOrder,
  ) {}

  @Post()
  createOrder(
    @Body({ schema: createOrderBody }) body: z.infer<typeof createOrderBody>,
  ): Promise<CreateOrderResult> {
    return this.createOrderUseCase(body);
  }

  @Post(':orderId/lines')
  @HttpCode(200)
  addOrderLine(
    @Param({ schema: addOrderLineParams })
    params: z.infer<typeof addOrderLineParams>,
    @Body({ schema: addOrderLineBody }) body: z.infer<typeof addOrderLineBody>,
  ): Promise<AddOrderLineResult> {
    return this.addOrderLineUseCase({ ...params, ...body });
  }

  @Post(':orderId/place')
  @HttpCode(200)
  placeOrder(
    @Param({ schema: placeOrderParams })
    params: z.infer<typeof placeOrderParams>,
    @Body({ schema: placeOrderBody }) body: z.infer<typeof placeOrderBody>,
  ): Promise<PlaceOrderResult> {
    return this.placeOrderUseCase({ ...params, ...body });
  }

  @Post(':orderId/cancel')
  @HttpCode(200)
  cancelOrder(
    @Param({ schema: cancelOrderParams })
    params: z.infer<typeof cancelOrderParams>,
    @Body({ schema: cancelOrderBody }) body: z.infer<typeof cancelOrderBody>,
  ): Promise<CancelOrderResult> {
    return this.cancelOrderUseCase({ ...params, ...body });
  }

  @Get(':orderId')
  getOrder(
    @Param({ schema: getOrderParams }) params: z.infer<typeof getOrderParams>,
    @Query({ schema: getOrderQuery }) query: z.infer<typeof getOrderQuery>,
  ): Promise<GetOrderResult> {
    return this.getOrderUseCase({ ...params, ...query });
  }
}

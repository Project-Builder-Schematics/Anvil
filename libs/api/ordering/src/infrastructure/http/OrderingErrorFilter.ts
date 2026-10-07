import { Catch, Inject, type ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { OrderingError, type OrderingErrorCode } from '../../domain/errors';

const STATUS: Record<OrderingErrorCode, number> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_EDITABLE: 409,
  ORDER_NOT_CANCELLABLE: 409,
  QUANTITY_OUT_OF_RANGE: 422,
  PRODUCT_NOT_FOUND: 422,
  ORDER_EMPTY: 422,
  CURRENCY_MISMATCH: 422,
};

@Catch(OrderingError)
export class OrderingErrorFilter {
  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
  ) {}

  catch(error: OrderingError, host: ArgumentsHost): void {
    const statusCode = STATUS[error.code];
    this.adapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode, code: error.code },
      statusCode,
    );
  }
}

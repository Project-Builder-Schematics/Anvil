import { Catch, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { OrderingError, type OrderingErrorCode } from '../../domain/errors';

const STATUS: Partial<Record<OrderingErrorCode, number>> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_EDITABLE: 409,
  QUANTITY_OUT_OF_RANGE: 422,
  PRODUCT_NOT_FOUND: 422,
  CURRENCY_MISMATCH: 422,
  ORDER_EMPTY: 422,
  ORDER_NOT_CANCELLABLE: 409,
  INSUFFICIENT_STOCK: 409,
  PAYMENT_DECLINED: 402,
};

@Catch(OrderingError)
export class OrderingErrorFilter extends BaseExceptionFilter<OrderingError> {
  private readonly logger = new Logger(OrderingErrorFilter.name);

  override catch(exception: OrderingError, host: ArgumentsHost): void {
    const adapter = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
    if (!adapter) {
      super.catch(exception, host);
      return;
    }
    const status = STATUS[exception.code];
    if (status === undefined)
      this.logger.error(
        `${exception.code} has no status in the Driving adapters table, answering 500`,
      );
    const statusCode = status ?? 500;
    adapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode, code: exception.code },
      statusCode,
    );
  }
}

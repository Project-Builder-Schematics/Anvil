import { Catch, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ORDERING_ERROR } from '../../domain/errors';

const STATUS: Record<string, number> = {
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_EDITABLE: 409,
  QUANTITY_OUT_OF_RANGE: 422,
  PRODUCT_NOT_FOUND: 422,
  CURRENCY_MISMATCH: 422,
  ORDER_EMPTY: 422,
  ORDER_NOT_CANCELLABLE: 409,
};

const isDomainError = (error: unknown): error is { code: string } =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  typeof error.code === 'string' &&
  Object.hasOwn(ORDERING_ERROR, error.code);

@Catch()
export class OrderingErrorFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const adapter = this.applicationRef ?? this.httpAdapterHost?.httpAdapter;
    if (!adapter || !isDomainError(exception)) {
      super.catch(exception, host);
      return;
    }
    const statusCode = STATUS[exception.code] ?? 500;
    adapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode, code: exception.code },
      statusCode,
    );
  }
}

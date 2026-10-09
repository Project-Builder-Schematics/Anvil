import { Catch, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { InventoryError, type InventoryErrorCode } from '../../domain/errors';

const STATUS: Partial<Record<InventoryErrorCode, number>> = {
  STOCK_LEVEL_INVALID: 422,
  PRODUCT_NOT_STOCKED: 404,
};

@Catch(InventoryError)
export class InventoryErrorFilter extends BaseExceptionFilter<InventoryError> {
  private readonly logger = new Logger(InventoryErrorFilter.name);

  override catch(exception: InventoryError, host: ArgumentsHost): void {
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

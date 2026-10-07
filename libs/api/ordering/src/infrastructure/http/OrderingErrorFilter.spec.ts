import type { ArgumentsHost } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { ORDERING_ERROR, OrderingError } from '../../domain/errors';
import { OrderingErrorFilter } from './OrderingErrorFilter';

const EXPECTED_STATUS = {
  QUANTITY_OUT_OF_RANGE: 422,
  ORDER_NOT_EDITABLE: 409,
  PRODUCT_NOT_FOUND: 422,
  ORDER_EMPTY: 422,
  CURRENCY_MISMATCH: 422,
  ORDER_NOT_CANCELLABLE: 409,
  ORDER_NOT_FOUND: 404,
} as const;

describe('OrderingErrorFilter', () => {
  it('maps every ordering error code to its documented status', () => {
    expect(Object.keys(EXPECTED_STATUS).sort()).toEqual(
      Object.keys(ORDERING_ERROR).sort(),
    );
    for (const [code, status] of Object.entries(EXPECTED_STATUS)) {
      const replies: unknown[][] = [];
      const response = {};
      const filter = new OrderingErrorFilter({
        httpAdapter: { reply: (...args: unknown[]) => replies.push(args) },
      } as unknown as HttpAdapterHost);
      const host = {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost;

      filter.catch(
        new OrderingError(code as keyof typeof ORDERING_ERROR),
        host,
      );

      expect(replies).toEqual([
        [response, { statusCode: status, code }, status],
      ]);
    }
  });
});

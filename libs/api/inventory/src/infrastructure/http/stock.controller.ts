import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import { InventoryErrorFilter } from './InventoryErrorFilter';
import { z } from 'zod';
import {
  SET_STOCK_LEVEL,
  type SetStockLevel,
  type SetStockLevelResult,
} from '../../application/SetStockLevel';
import {
  GET_STOCK_LEVEL,
  type GetStockLevel,
  type GetStockLevelResult,
} from '../../application/GetStockLevel';

const setStockLevelParams = z.object({ productId: z.string().trim().min(1) });
const setStockLevelBody = z.object({ onHand: z.number() });
const getStockLevelParams = z.object({ productId: z.string().trim().min(1) });
const getStockLevelQuery = z.object({});

@Controller('stock')
@UseFilters(InventoryErrorFilter)
export class StockController {
  constructor(
    @Inject(SET_STOCK_LEVEL)
    private readonly setStockLevelUseCase: SetStockLevel,
    @Inject(GET_STOCK_LEVEL)
    private readonly getStockLevelUseCase: GetStockLevel,
  ) {}

  @Put(':productId')
  setStockLevel(
    @Param({ schema: setStockLevelParams })
    params: z.infer<typeof setStockLevelParams>,
    @Body({ schema: setStockLevelBody })
    body: z.infer<typeof setStockLevelBody>,
  ): Promise<SetStockLevelResult> {
    return this.setStockLevelUseCase({ ...params, ...body });
  }

  @Get(':productId')
  getStockLevel(
    @Param({ schema: getStockLevelParams })
    params: z.infer<typeof getStockLevelParams>,
    @Query({ schema: getStockLevelQuery })
    query: z.infer<typeof getStockLevelQuery>,
  ): Promise<GetStockLevelResult> {
    return this.getStockLevelUseCase({ ...params, ...query });
  }
}

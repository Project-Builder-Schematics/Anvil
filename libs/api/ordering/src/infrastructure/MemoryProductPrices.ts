import { Injectable } from '@nestjs/common';
import type { ProductPrices } from '../domain/driven-ports/ProductPrices';

@Injectable()
export class MemoryProductPrices implements ProductPrices {}

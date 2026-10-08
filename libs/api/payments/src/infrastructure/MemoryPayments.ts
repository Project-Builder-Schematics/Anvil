import { Injectable } from '@nestjs/common';
import type { Payments } from '../domain/driven-ports/Payments';

@Injectable()
export class MemoryPayments implements Payments {}

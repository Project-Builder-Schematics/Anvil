import { Injectable } from '@nestjs/common';
import type { PaymentGateway } from '../domain/driven-ports/PaymentGateway';

@Injectable()
export class MemoryPaymentGateway implements PaymentGateway {}

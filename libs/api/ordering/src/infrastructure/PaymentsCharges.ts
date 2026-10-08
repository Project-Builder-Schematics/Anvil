import { Injectable } from '@nestjs/common';
import type * as payments from '@demo/api-payments';
import type { Charges } from '../domain/driven-ports/Charges';

// Translates this port into payments's language: the only file of the slice that knows its barrel.
export type PaymentsApi = typeof payments;

@Injectable()
export class PaymentsCharges implements Charges {}

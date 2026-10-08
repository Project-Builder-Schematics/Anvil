import { Injectable } from '@nestjs/common';
import type { Reservations } from '../domain/driven-ports/Reservations';

@Injectable()
export class MemoryReservations implements Reservations {}

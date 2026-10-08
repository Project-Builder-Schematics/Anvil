import { Injectable } from '@nestjs/common';
import type { DomainEvents } from '../domain/driven-ports/DomainEvents';

@Injectable()
export class MemoryDomainEvents implements DomainEvents {}

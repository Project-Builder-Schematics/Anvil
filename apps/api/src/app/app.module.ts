import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from '../config';
import { HealthController } from './health.controller';
import { OrderingModule } from '@demo/api-ordering';
import { InventoryModule } from '@demo/api-inventory';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    OrderingModule,
    InventoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

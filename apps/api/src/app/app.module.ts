import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from '../config';
import { HealthController } from './health.controller';
import { OrderingModule } from '@demo/api-ordering';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    OrderingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

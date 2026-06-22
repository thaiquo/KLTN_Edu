import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { envConfig } from '../config/env.config';

@Global()
@Module({
  imports: [
    MongooseModule.forRoot(envConfig.mongodbUri)
  ],
  exports: [MongooseModule]
})
export class DatabaseModule {}

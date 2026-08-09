import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { envConfig } from '../../config/env.config';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UserModule,
    JwtModule.register({ secret: envConfig.jwtSecret, signOptions: { expiresIn: envConfig.jwtExpiresIn as any } })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService]
})
export class AuthModule {}

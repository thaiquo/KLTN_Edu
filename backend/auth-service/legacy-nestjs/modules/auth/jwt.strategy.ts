import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { envConfig } from '../../config/env.config';

export interface JwtPayload { sub: string; email: string; role: 'student' | 'tutor' | 'admin'; }

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), ignoreExpiration: false, secretOrKey: envConfig.jwtSecret });
  }
  validate(payload: JwtPayload) { return payload; }
}

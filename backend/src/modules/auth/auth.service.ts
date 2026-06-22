import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { envConfig } from '../../config/env.config';
import { UserService } from '../user/user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    const createdUser = await this.userService.createStudent({
      fullName: dto.fullName,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10)
    });
    return this.createAuthResponse(createdUser);
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmailWithPassword(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return this.createAuthResponse(user);
  }

  getCurrentUser(userId: string) {
    return this.userService.findSafeUserById(userId);
  }

  private createAuthResponse(user: Parameters<UserService['toSafeUser']>[0]) {
    const safeUser = this.userService.toSafeUser(user);
    const accessToken = this.jwtService.sign(
      { sub: safeUser.id, email: safeUser.email, role: safeUser.role },
      { secret: envConfig.jwtSecret, expiresIn: envConfig.jwtExpiresIn as any }
    );

    return {
      user: safeUser,
      accessToken
    };
  }
}

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcryptjs");
const env_config_1 = require("../../config/env.config");
const user_service_1 = require("../user/user.service");
let AuthService = class AuthService {
    constructor(userService, jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }
    async register(dto) {
        const createdUser = await this.userService.createStudent({
            fullName: dto.fullName,
            email: dto.email,
            phone: dto.phone,
            password: await bcrypt.hash(dto.password, 10)
        });
        return this.createAuthResponse(createdUser);
    }
    async login(dto) {
        const user = await this.userService.findByEmailWithPassword(dto.email);
        if (!user || !(await bcrypt.compare(dto.password, user.password))) {
            throw new common_1.UnauthorizedException('Email or password is incorrect');
        }
        return this.createAuthResponse(user);
    }
    getCurrentUser(userId) {
        return this.userService.findSafeUserById(userId);
    }
    createAuthResponse(user) {
        const safeUser = this.userService.toSafeUser(user);
        const accessToken = this.jwtService.sign({ sub: safeUser.id, email: safeUser.email, role: safeUser.role }, { secret: env_config_1.envConfig.jwtSecret, expiresIn: env_config_1.envConfig.jwtExpiresIn });
        return {
            user: safeUser,
            accessToken
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map
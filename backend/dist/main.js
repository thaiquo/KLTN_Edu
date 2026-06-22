"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const express_1 = require("express");
const path_1 = require("path");
const app_module_1 = require("./app.module");
const env_config_1 = require("./config/env.config");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({ origin: env_config_1.envConfig.corsOrigins, credentials: true });
    app.use('/uploads', (0, express_1.static)((0, path_1.resolve)(process.cwd(), 'uploads')));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
    }));
    await app.listen(env_config_1.envConfig.port);
    console.log(`EduConnect backend running on http://localhost:${env_config_1.envConfig.port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map
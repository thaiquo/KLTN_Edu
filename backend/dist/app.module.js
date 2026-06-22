"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const common_module_1 = require("./common/common.module");
const database_module_1 = require("./database/database.module");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/user/user.module");
const catalog_module_1 = require("./modules/catalog/catalog.module");
const post_module_1 = require("./modules/post/post.module");
const classroom_module_1 = require("./modules/classroom/classroom.module");
const session_module_1 = require("./modules/session/session.module");
const assignment_module_1 = require("./modules/assignment/assignment.module");
const chat_module_1 = require("./modules/chat/chat.module");
const engagement_module_1 = require("./modules/engagement/engagement.module");
const wallet_module_1 = require("./modules/wallet/wallet.module");
const payment_module_1 = require("./modules/payment/payment.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            common_module_1.CommonModule,
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            catalog_module_1.CatalogModule,
            post_module_1.PostModule,
            classroom_module_1.ClassroomModule,
            session_module_1.SessionModule,
            assignment_module_1.AssignmentModule,
            chat_module_1.ChatModule,
            engagement_module_1.EngagementModule,
            wallet_module_1.WalletModule,
            payment_module_1.PaymentModule
        ],
        controllers: [app_controller_1.AppController],
        providers: []
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
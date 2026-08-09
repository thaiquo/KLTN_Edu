import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { PostModule } from './modules/post/post.module';
import { ClassroomModule } from './modules/classroom/classroom.module';
import { SessionModule } from './modules/session/session.module';
import { AssignmentModule } from './modules/assignment/assignment.module';
import { ChatModule } from './modules/chat/chat.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SocketModule } from './modules/socket/socket.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // kích hoạt @Cron decorator cho toàn bộ ứng dụng
    SocketModule,             // @Global() → SocketService available toàn app
    CommonModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    CatalogModule,
    PostModule,
    ClassroomModule,
    SessionModule,
    AssignmentModule,
    ChatModule,
    EngagementModule,
    WalletModule,
    PaymentModule
  ],
  controllers: [AppController],
  providers: []
})
export class AppModule {}

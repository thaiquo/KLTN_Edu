import { Global, Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { SocketService } from './socket.service';

/**
 * @Global() → SocketService tự động available trong toàn bộ app
 * mà không cần import SocketModule từng module con.
 */
@Global()
@Module({
  providers: [SocketService, AppGateway],
  exports: [SocketService]
})
export class SocketModule {}

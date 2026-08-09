import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Tên room cá nhân của mỗi user.
 * Mỗi client khi kết nối sẽ join room này để nhận event riêng tư.
 */
export const userRoom = (userId: string) => `user:${userId}`;

/** Room dành riêng cho tất cả admin đang online. */
export const ADMIN_ROOM = 'room:admin';

/**
 * SocketService – wrapper mỏng quanh Socket.IO Server.
 *
 * Các service khác (CertificateService, UserService, …) inject
 * SocketService để push realtime event mà không cần biết chi tiết WS.
 *
 * Pattern:
 *   emitToUser(userId, event, data)  → gửi cho user cụ thể
 *   emitToAdmin(event, data)         → broadcast đến tất cả admin online
 *   emitToAll(event, data)           → broadcast toàn bộ client
 */
@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private _server: Server | null = null;

  /** AppGateway gọi method này để truyền server instance vào. */
  setServer(server: Server) {
    this._server = server;
  }

  /** Gửi event đến room cá nhân của một user. */
  emitToUser(userId: string, event: string, data: unknown) {
    if (!this._server) return;
    this._server.to(userRoom(userId)).emit(event, data);
    this.logger.verbose(`→ user:${userId}  [${event}]`);
  }

  /** Broadcast đến tất cả admin đang online (room: room:admin). */
  emitToAdmin(event: string, data: unknown) {
    if (!this._server) return;
    this._server.to(ADMIN_ROOM).emit(event, data);
    this.logger.verbose(`→ room:admin  [${event}]`);
  }

  /** Broadcast toàn bộ client đang kết nối. */
  emitToAll(event: string, data: unknown) {
    if (!this._server) return;
    this._server.emit(event, data);
    this.logger.verbose(`→ ALL  [${event}]`);
  }

  /** Kiểm tra server đã được gán chưa (dùng cho health-check). */
  get isReady() {
    return this._server !== null;
  }
}

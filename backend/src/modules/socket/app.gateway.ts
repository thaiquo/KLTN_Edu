import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { envConfig } from '../../config/env.config';
import { JwtPayload } from '../auth/jwt.strategy';
import { ADMIN_ROOM, SocketService, userRoom } from './socket.service';

/**
 * AppGateway
 *
 * Cổng WebSocket chính của ứng dụng.
 * Tất cả client (admin / tutor / student) kết nối qua đây.
 *
 * ── Xác thực ──────────────────────────────────────────────────
 * Client phải gửi JWT trong handshake:
 *   { auth: { token: '<jwt>' } }
 *   hoặc query: ?token=<jwt>
 *
 * ── Rooms ─────────────────────────────────────────────────────
 *   user:{userId}   → mỗi user có room riêng nhận thông báo
 *   room:admin      → tất cả admin online
 *
 * ── Events từ server → client ─────────────────────────────────
 *   certificate:new              admin ← khi tutor nộp cert mới
 *   certificate:updated          admin ← khi tutor cập nhật cert
 *   certificate:approved         user  ← khi admin duyệt
 *   certificate:rejected         user  ← khi admin từ chối
 *   certificate:update_requested user  ← khi admin yêu cầu cập nhật
 *   certificate:revoked          user  ← khi admin thu hồi
 *   notification:new             user  ← thông báo chung
 *
 * ── Events từ client → server ─────────────────────────────────
 *   ping                         → server trả về pong (health-check)
 */
@WebSocketGateway({
  cors: {
    origin: envConfig.corsOrigins,
    credentials: true
  },
  namespace: '/',
  transports: ['websocket', 'polling']
})
export class AppGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(AppGateway.name);

  /** Map: socketId → userId (để log & cleanup) */
  private readonly connections = new Map<string, string>();

  constructor(private readonly socketService: SocketService) {}

  // ── lifecycle ────────────────────────────────────────────────

  afterInit(server: Server) {
    this.socketService.setServer(server);
    this.logger.log('WebSocket Gateway initialized ✅');
  }

  handleConnection(client: Socket) {
    const payload = this.authenticate(client);
    if (!payload) {
      client.emit('error', { message: 'Unauthorized: invalid or missing token' });
      client.disconnect(true);
      return;
    }

    const { sub: userId, role } = payload;
    (client as any).userId = userId;
    (client as any).role   = role;

    // join phòng cá nhân
    client.join(userRoom(userId));

    // admin join phòng quản trị
    if (role === 'admin') {
      client.join(ADMIN_ROOM);
      this.logger.log(`Admin connected  socket=${client.id}  userId=${userId}`);
    } else {
      this.logger.log(`Client connected socket=${client.id}  userId=${userId}  role=${role}`);
    }

    this.connections.set(client.id, userId);

    // xác nhận kết nối thành công
    client.emit('connected', { userId, role });
  }

  handleDisconnect(client: Socket) {
    const userId = this.connections.get(client.id) ?? 'unknown';
    this.connections.delete(client.id);
    this.logger.log(`Client disconnected socket=${client.id}  userId=${userId}`);
  }

  // ── events từ client ────────────────────────────────────────

  /** Health-check đơn giản */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    client.emit('pong', { ts: Date.now(), echo: data });
  }

  /**
   * Admin muốn join/leave các room động (tuỳ chọn).
   * Không bắt buộc – admin đã tự động join room:admin khi connect.
   */
  @SubscribeMessage('room:join')
  handleRoomJoin(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    if (!(client as any).role || (client as any).role !== 'admin') return;
    client.join(room);
    client.emit('room:joined', { room });
  }

  // ── helper ───────────────────────────────────────────────────

  private authenticate(client: Socket): JwtPayload | null {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)?.token ??
        (client.handshake.query as Record<string, string>)?.token ??
        '';
      if (!token) return null;
      return jwt.verify(token, envConfig.jwtSecret) as JwtPayload;
    } catch {
      return null;
    }
  }
}

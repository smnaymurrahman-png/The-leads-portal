import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/types';

/** Each principal (user OR client) gets a private room keyed by their id. */
export function roomFor(principalId: string): string {
  return `room:${principalId}`;
}

/** How long to wait for a client to acknowledge a delivered lead. */
const ACK_TIMEOUT_MS = 5_000;

/**
 * Socket.IO gateway. Authenticated with the same JWT as the REST API:
 * an unauthenticated socket is disconnected immediately. Every authenticated
 * socket joins the private room for its principal id.
 *
 * `cors.origin: true` reflects the request origin — fine for local dev; lock
 * this to the web origin in production.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(socket: Socket): void {
    const token = extractToken(socket);
    if (!token) {
      this.reject(socket, 'Missing auth token');
      return;
    }
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token);
    } catch {
      this.reject(socket, 'Invalid or expired token');
      return;
    }
    socket.data.principalId = payload.sub;
    socket.data.role = payload.role;
    void socket.join(roomFor(payload.sub));
    this.logger.log(`Socket ${socket.id} authenticated → ${roomFor(payload.sub)}`);
  }

  private reject(socket: Socket, reason: string): void {
    socket.emit('unauthorized', { message: reason });
    socket.disconnect(true);
  }

  /** Fire-and-forget broadcast to one principal's private room. */
  emitToPrincipal(principalId: string, event: string, payload: unknown): void {
    if (!this.server) {
      return;
    }
    this.server.to(roomFor(principalId)).emit(event, payload);
  }

  /**
   * Delivers an event to a principal's room and waits for an acknowledgement.
   * Resolves true only when at least one of the principal's sockets confirms
   * receipt within the timeout — the signal that delivery actually happened.
   */
  async deliverWithAck(
    principalId: string,
    event: string,
    payload: unknown,
  ): Promise<boolean> {
    if (!this.server) {
      return false;
    }
    const room = roomFor(principalId);
    const sockets = await this.server.in(room).fetchSockets();
    if (sockets.length === 0) {
      return false; // principal is offline — nothing can acknowledge
    }
    return new Promise<boolean>((resolve) => {
      this.server
        .to(room)
        .timeout(ACK_TIMEOUT_MS)
        .emit(event, payload, (_error: Error | null, responses: unknown[]) => {
          resolve(Array.isArray(responses) && responses.length > 0);
        });
    });
  }
}

/** Reads the JWT from the handshake `auth` payload or a `token` query param. */
function extractToken(socket: Socket): string | undefined {
  const auth = socket.handshake.auth as { token?: unknown } | undefined;
  if (typeof auth?.token === 'string' && auth.token.length > 0) {
    return auth.token;
  }
  const queryToken = socket.handshake.query?.token;
  return typeof queryToken === 'string' ? queryToken : undefined;
}

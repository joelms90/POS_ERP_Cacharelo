import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import * as url from 'url';
import { JwtService } from '@nestjs/jwt';
import { SyncService } from './sync.service';
import { forwardRef, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { Client } from 'pg';

@WebSocketGateway({ path: '/sync' })
export class SyncGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(SyncGateway.name);
  private pgListenerClient: Client;
  private readonly instanceId = Math.random().toString(36).substring(7);

  @WebSocketServer()
  server: any;

  // Map to store connected clients by branchId
  private activeClients = new Map<string, Set<any>>();

  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => SyncService))
    private readonly syncService: SyncService,
  ) {}

  async handleConnection(client: any, request: IncomingMessage) {
    try {
      const requestUrl = request.url || '';
      const parsedUrl = url.parse(requestUrl, true);
      const query = parsedUrl.query;
      const token = query.token as string;
      const branchId = query.branchId as string;
      const role = query.role as string;

      if (!token || !branchId || !role) {
        client.close(4001, 'Faltan parámetros de conexión (token, branchId, role)');
        return;
      }

      // Verify JWT token
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key';
      const decoded = this.jwtService.verify(token, { secret });

      // Save authenticated details on client
      client.user = decoded;
      client.branchId = branchId;
      client.role = role;

      // Register client in branch room
      if (!this.activeClients.has(branchId)) {
        this.activeClients.set(branchId, new Set());
      }
      this.activeClients.get(branchId)!.add(client);

      // Send welcome handshake message to establish connected state on client
      client.send(JSON.stringify({ tipo: 'welcome', status: 'connected' }));

      this.logger.log(
        `Client connected: branch=${branchId}, role=${role}, userId=${
          decoded.id || 'unknown'
        }`,
      );
    } catch (error) {
      this.logger.error('WebSocket connection authentication failed', error);
      client.close(4003, 'Token inválido o expirado');
    }
  }

  handleDisconnect(client: any) {
    const branchId = client.branchId;
    if (branchId && this.activeClients.has(branchId)) {
      const clients = this.activeClients.get(branchId)!;
      clients.delete(client);
      if (clients.size === 0) {
        this.activeClients.delete(branchId);
      }
      this.logger.log(`Client disconnected: branch=${branchId}, role=${client.role}`);
    }
  }

  afterInit(server: any) {
    this.setupPostgresListener();
  }

  onModuleDestroy() {
    this.cleanupPgListener();
  }

  private async setupPostgresListener() {
    const connectionString = process.env.DATABASE_URL || 'postgres://pos_user:pos_password@localhost:5432/pos_dev';
    
    const connectAndListen = async () => {
      try {
        this.pgListenerClient = new Client({ connectionString });
        await this.pgListenerClient.connect();
        
        await this.pgListenerClient.query('LISTEN branch_sync_channel');
        this.logger.log('PostgreSQL LISTEN branch_sync_channel connection established');

        this.pgListenerClient.on('notification', (msg: any) => {
          if (msg.channel === 'branch_sync_channel' && msg.payload) {
            try {
              const { instanceId, branchId, payload } = JSON.parse(msg.payload);
              if (instanceId !== this.instanceId) {
                this.logger.debug(`Received cross-instance sync notify for branch ${branchId}`);
                this.broadcastLocalChange(branchId, payload);
              }
            } catch (err) {
              this.logger.error('Failed to parse Postgres notification payload', err);
            }
          }
        });

        this.pgListenerClient.on('error', async (err: any) => {
          this.logger.error('PostgreSQL listener client connection error, reconnecting...', err);
          this.cleanupPgListener();
          setTimeout(connectAndListen, 5000);
        });

        this.pgListenerClient.on('end', async () => {
          this.logger.warn('PostgreSQL listener client connection ended, reconnecting...');
          this.cleanupPgListener();
          setTimeout(connectAndListen, 5000);
        });

      } catch (error) {
        this.logger.error('Failed to connect PostgreSQL listener client, retrying in 5s...', error);
        setTimeout(connectAndListen, 5000);
      }
    };

    await connectAndListen();
  }

  private cleanupPgListener() {
    try {
      if (this.pgListenerClient) {
        this.pgListenerClient.removeAllListeners();
        this.pgListenerClient.end().catch(() => {});
      }
    } catch (e) {}
  }

  private broadcastLocalChange(branchId: string, payload: any) {
    const clients = this.activeClients.get(branchId);
    if (!clients) return;

    const message = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === 1 /* OPEN */) {
        client.send(message);
      }
    }
  }

  // Helper method for broadcasting changes to a branch
  broadcastChange(branchId: string, payload: any, excludeClient?: any) {
    // 1. Send to local clients connected to this instance
    const clients = this.activeClients.get(branchId);
    if (clients) {
      const message = JSON.stringify(payload);
      for (const client of clients) {
        if (client !== excludeClient && client.readyState === 1 /* OPEN */) {
          client.send(message);
        }
      }
    }

    // 2. Notify other instances via Postgres Pub/Sub
    this.publishNotification(branchId, payload).catch((err) => {
      this.logger.error(`Failed to publish PG notification for branch ${branchId}`, err);
    });
  }

  private async publishNotification(branchId: string, payload: any) {
    const notifyPayload = JSON.stringify({
      instanceId: this.instanceId,
      branchId,
      payload,
    });

    // Handle the 8000 bytes notify size limit
    if (notifyPayload.length > 7900) {
      this.logger.warn(`Sync notification too large (${notifyPayload.length} bytes), sending lightweight reload trigger`);
      const lightweightPayload = JSON.stringify({
        instanceId: this.instanceId,
        branchId,
        payload: {
          tipo: 'cambio',
          changes: payload.changes?.map((c: any) => ({
            entity: c.entity,
            entityId: c.entityId,
          })) || []
        },
      });
      if (this.pgListenerClient) {
        await this.pgListenerClient.query(`SELECT pg_notify('branch_sync_channel', $1)`, [lightweightPayload]);
      }
    } else {
      if (this.pgListenerClient) {
        await this.pgListenerClient.query(`SELECT pg_notify('branch_sync_channel', $1)`, [notifyPayload]);
      }
    }
  }

  @SubscribeMessage('push')
  async handlePush(@ConnectedSocket() client: any, @MessageBody() data: any) {
    let client_uuid = '';
    try {
      // The ws engine passes the raw string or parsed object
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      client_uuid = parsedData.client_uuid;
      const { entidad, entity, payload } = parsedData;
      const activeEntity = entidad || entity;

      if (!client_uuid || !payload) {
        client.send(
          JSON.stringify({
            tipo: 'ack',
            client_uuid,
            status: 'error',
            message: 'Datos de push incompletos',
          }),
        );
        return;
      }

      let pushDto: any = {};
      if (activeEntity) {
        if (activeEntity === 'orders') {
          pushDto.orders = [payload];
        } else if (activeEntity === 'orderItems') {
          pushDto.orderItems = [payload];
        } else if (activeEntity === 'payments') {
          pushDto.payments = [payload];
        } else if (activeEntity === 'cashShifts') {
          pushDto.cashShifts = [payload];
        } else if (activeEntity === 'cashTransactions') {
          pushDto.cashTransactions = [payload];
        } else {
          client.send(
            JSON.stringify({
              tipo: 'ack',
              client_uuid,
              status: 'error',
              message: `Entidad desconocida: ${activeEntity}`,
            }),
          );
          return;
        }
      } else {
        // Full transaction payload matching PushSyncDto
        pushDto = payload;
      }

      // Execute logic through the unmodified SyncService.push()
      await this.syncService.push(pushDto);

      // Send ACK back to sender
      client.send(
        JSON.stringify({
          tipo: 'ack',
          client_uuid,
          status: 'success',
          version_en: new Date().toISOString(),
        }),
      );
    } catch (error) {
      this.logger.error('WebSocket push failed', error);
      client.send(
        JSON.stringify({
          tipo: 'ack',
          client_uuid: client_uuid || undefined,
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Error interno al guardar',
        }),
      );
    }
  }

  @SubscribeMessage('resync')
  async handleResync(@ConnectedSocket() client: any, @MessageBody() data: any) {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      const { desde } = parsedData;
      const branchId = client.branchId;

      if (!desde || !branchId) {
        client.send(
          JSON.stringify({
            tipo: 'cambios',
            items: [],
            error: 'Parámetros de resync inválidos',
          }),
        );
        return;
      }

      // Query from changeLog for this sucursal since timestamp
      const changes = await this.syncService.getChangeLogSince(branchId, desde);

      client.send(
        JSON.stringify({
          tipo: 'cambios',
          items: changes,
          server_time: new Date().toISOString(),
        }),
      );
    } catch (error) {
      this.logger.error('WebSocket resync failed', error);
      client.send(
        JSON.stringify({
          tipo: 'cambios',
          items: [],
          error: error instanceof Error ? error.message : 'Error al resincronizar',
        }),
      );
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: any) {
    try {
      client.send(JSON.stringify({ tipo: 'pong' }));
    } catch (error) {
      this.logger.warn(`Failed to send pong to client: ${error}`);
    }
  }
}

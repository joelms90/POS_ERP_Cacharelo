import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import {
  fingerprintOf,
  redactQueryParams,
  scrubSecrets,
  stripQueryParams,
} from './log-entry';
import { LogsService } from './logs.service';

/**
 * Records every unhandled / 5xx error thrown by an HTTP handler into
 * app_logs (source = sync_api), then rethrows so Nest's normal error
 * response is unchanged. 4xx errors are expected business outcomes and
 * are not recorded.
 */
@Injectable()
export class ServerErrorsInterceptor implements NestInterceptor {
  constructor(private readonly logs: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        if (status >= 500) {
          try {
            this.capture(context, err, status);
          } catch {
            // never let logging interfere with the response
          }
        }
        return throwError(() => err);
      }),
    );
  }

  private capture(context: ExecutionContext, err: unknown, status: number) {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? {};
    const path: string = (req.originalUrl ?? req.url ?? '').toString();
    const routePattern: string = req.route?.path ?? path.split('?')[0];
    const message = redactQueryParams(
      scrubSecrets(err instanceof Error ? err.message : String(err)),
    ).slice(0, 2000);
    const pick = (key: string): string | null => {
      const v = req.query?.[key] ?? req.body?.[key] ?? req.params?.[key];
      return typeof v === 'string' && v ? v.slice(0, 64) : null;
    };

    void this.logs.record([
      {
        source: 'sync_api',
        level: 'error',
        message,
        stack:
          err instanceof Error && err.stack
            ? redactQueryParams(scrubSecrets(err.stack)).slice(0, 8000)
            : null,
        fingerprint: fingerprintOf(
          'sync_api',
          stripQueryParams(message),
          `${req.method} ${routePattern}`,
        ),
        occurredAt: new Date(),
        businessId: pick('businessId') ?? user.businessId ?? null,
        branchId: pick('branchId') ?? user.branchId ?? null,
        branchName: null,
        userId: user.sub ?? user.id ?? null,
        userName: user.name ?? null,
        userRole: user.role ?? null,
        deviceId: pick('deviceId'),
        appVersion: process.env.K_REVISION ?? null,
        platform: 'cloud_run',
        route: scrubSecrets(path).slice(0, 500),
        httpMethod: req.method ?? null,
        httpStatus: status,
        context: {
          handler: `${context.getClass().name}.${context.getHandler().name}`,
          routePattern,
          errorName: err instanceof Error ? err.name : typeof err,
        },
        breadcrumbs: null,
        userAgent:
          (req.headers?.['user-agent'] ?? '').toString().slice(0, 300) || null,
      },
    ]);
  }
}

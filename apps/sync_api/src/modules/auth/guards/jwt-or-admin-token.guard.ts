import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OWNER_ROLE } from '../roles';

/**
 * Accepts the legacy Business Control `X-Admin-Token` (as owner) or a bearer
 * JWT. Used on report endpoints that were unguarded before spec 019 so legacy
 * admin sessions keep working while unauthenticated callers are rejected.
 */
@Injectable()
export class JwtOrAdminTokenGuard implements CanActivate {
  constructor(private readonly jwtGuard: JwtAuthGuard) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-admin-token'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (
      typeof token === 'string' &&
      token.length > 0 &&
      token === adminPassword
    ) {
      request.user = {
        role: OWNER_ROLE,
        roles: [OWNER_ROLE],
        legacyAdmin: true,
      };
      return true;
    }
    return this.jwtGuard.canActivate(context);
  }
}

import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { OWNER_ROLE } from '../roles';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-admin-token'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (token === adminPassword) {
      request.user = { role: OWNER_ROLE, legacyAdmin: true };
      return true;
    }

    const authHeader = request.headers.authorization || request.headers.Authorization;
    const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : null;

    if (bearerToken) {
      try {
        const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key';
        const payload = this.jwtService.verify(bearerToken, { secret });
        if (payload.role === OWNER_ROLE) {
          request.user = payload;
          return true;
        }
      } catch {
        // fall through to unauthorized response
      }
    }

    throw new HttpException(
      { error: 'No autorizado. Se requiere contraseña de administrador.' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

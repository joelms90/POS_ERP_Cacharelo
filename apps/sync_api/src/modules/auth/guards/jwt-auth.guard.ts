import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization || request.headers.Authorization;
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring('Bearer '.length)
      : null;

    if (!token) {
      throw new HttpException({ error: 'No autorizado. Se requiere token.' }, HttpStatus.UNAUTHORIZED);
    }

    try {
      const secret = process.env.JWT_SECRET || 'dev_jwt_secret_key';
      request.user = this.jwtService.verify(token, { secret });
      return true;
    } catch {
      throw new HttpException({ error: 'Token invalido o expirado.' }, HttpStatus.UNAUTHORIZED);
    }
  }
}

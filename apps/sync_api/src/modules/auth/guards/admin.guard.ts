import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-admin-token'];
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    if (token === adminPassword) {
      return true;
    }

    throw new HttpException(
      { error: 'No autorizado. Se requiere contraseña de administrador.' },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

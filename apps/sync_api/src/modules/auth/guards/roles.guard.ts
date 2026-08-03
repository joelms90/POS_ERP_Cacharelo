import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AdminRole } from '../roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const roles = Array.isArray(request.user?.roles)
      ? request.user.roles
      : request.user?.role
        ? [request.user.role]
        : [];

    if (roles.includes('owner')) {
      return true;
    }

    if (requiredRoles.some((role) => roles.includes(role))) {
      return true;
    }

    throw new ForbiddenException('No tienes permisos para esta accion.');
  }
}

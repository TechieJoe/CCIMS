import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No roles required for this route
    }

    //const request: Request = context.switchToHttp().getRequest();
    //const user = request.user; // User from the session (passport-session)

   // if (!user) {
   //   return false; // No user in session
    //}

    // Check if the user has one of the required roles
    //return requiredRoles.some((role) => user.role === role);
  }
}

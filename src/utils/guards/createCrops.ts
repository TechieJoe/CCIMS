import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class FarmerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;  // Assumes the user is attached after authentication
    
    return user && user.role === 'farmer';  // Only farmers can access
  }
}

import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtAuthGuard.name);

    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        
        if (isPublic) {
            this.logger.log('JwtAuthGuard: Public endpoint, skipping authentication');
            return true;
        }

        this.logger.log('JwtAuthGuard: canActivate called');
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        this.logger.log('JwtAuthGuard: Authorization header:', authHeader ? 'Bearer [token]' : 'Missing');

        return super.canActivate(context);
    }
}
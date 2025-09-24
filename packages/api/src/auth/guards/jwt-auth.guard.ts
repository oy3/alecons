import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    private readonly logger = new Logger(JwtAuthGuard.name);

    canActivate(context: ExecutionContext) {
        this.logger.log('JwtAuthGuard: canActivate called');
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        this.logger.log('JwtAuthGuard: Authorization header:', authHeader ? 'Bearer [token]' : 'Missing');

        return super.canActivate(context);
    }
}
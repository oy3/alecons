import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private readonly logger = new Logger(JwtStrategy.name);
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private configService: ConfigService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });

        this.logger.log('JwtStrategy initialized with secret:', jwtSecret ? '[SECRET_SET]' : '[SECRET_MISSING]');
    }

    async validate(payload: any) {
        this.logger.log('JWT validation - payload:', payload);

        try {
            const user = await this.userModel.findById(payload.sub).select('-passwordHash');
            this.logger.log('JWT validation - user found:', {
                userId: user?._id,
                email: user?.email,
                isActive: user?.isActive
            });

            if (!user || !user.isActive) {
                this.logger.log('JWT validation - user not found or inactive');
                throw new UnauthorizedException('User not found or inactive');
            }

            return user;
        } catch (error) {
            this.logger.error('JWT validation error:', error.message);
            throw error;
        }
    }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private configService: ConfigService,
    ) {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        console.log('JwtStrategy initialized with secret:', jwtSecret ? '[SECRET_SET]' : '[SECRET_MISSING]');

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: any) {
        console.log('JWT validation - payload:', payload);

        try {
            const user = await this.userModel.findById(payload.sub).select('-passwordHash');
            console.log('JWT validation - user found:', {
                userId: user?._id,
                email: user?.email,
                isActive: user?.isActive
            });

            if (!user || !user.isActive) {
                console.log('JWT validation - user not found or inactive');
                throw new UnauthorizedException('User not found or inactive');
            }

            return user;
        } catch (error) {
            console.log('JWT validation error:', error.message);
            throw error;
        }
    }
}

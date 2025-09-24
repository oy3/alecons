import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('application/:id')
    @ApiOperation({ summary: 'Get application details' })
    @ApiResponse({ status: 200, description: 'Application details retrieved' })
    @ApiResponse({ status: 404, description: 'Application not found' })
    async getApplication(@Param('id') id: string) {
        return this.authService.getApplicationById(id);
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile retrieved' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getProfile(@Request() req) {
        console.log('Profile controller called - user:', {
            userId: req.user?._id,
            email: req.user?.email
        });

        try {
            const result = await this.authService.getCurrentUserProfile(req.user._id);
            console.log('Profile service result:', {
                success: result.success,
                hasUser: !!result.data?.user,
                hasApplication: !!result.data?.application
            });
            return result;
        } catch (error) {
            console.log('Profile controller error:', error.message);
            throw error;
        }
    }

    @Post('change-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change user password' })
    @ApiResponse({ status: 200, description: 'Password successfully changed' })
    @ApiResponse({ status: 400, description: 'Invalid current password or validation failed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Request() req) {
        return this.authService.changePassword(req.user._id, changePasswordDto);
    }
}

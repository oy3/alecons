import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @ApiOperation({ summary: 'Register new user' })
    @ApiResponse({ status: 201, description: 'User successfully registered' })
    @ApiResponse({ status: 409, description: 'User already exists' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Get('check-eligibility')
    @ApiOperation({ summary: 'Check if registration is currently allowed' })
    @ApiResponse({ status: 200, description: 'Registration eligibility status' })
    async checkRegistrationEligibility() {
        return this.authService.checkRegistrationEligibility();
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login user' })
    @ApiResponse({ status: 200, description: 'User successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('reapply')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new application for a new intake' })
    @ApiResponse({ status: 200, description: 'New application created' })
    async reapply(@Request() req) {
        return this.authService.reapplyApplication(req.user._id);
    }

    @Post('apply')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Apply for a specific intake with chosen program' })
    @ApiResponse({ status: 200, description: 'New application created' })
    async apply(@Request() req, @Body() body: { sessionId: string; programId: string }) {
        return this.authService.applyForIntake(req.user._id, body.sessionId, body.programId);
    }

    @Get('open-sessions')
    @ApiOperation({ summary: 'Get academic sessions open for new applications' })
    @ApiResponse({ status: 200, description: 'Open sessions retrieved' })
    async getOpenSessions() {
        return this.authService.getOpenSessions();
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
        this.logger.log('Profile controller called - user:', {
            userId: req.user?._id,
            email: req.user?.email
        });

        try {
            const result = await this.authService.getCurrentUserProfile(req.user._id);
            this.logger.log('Profile service result:', {
                success: result.success,
                hasUser: !!result.data?.user,
                hasApplication: !!result.data?.application
            });
            return result;
        } catch (error) {
            this.logger.error('Profile controller error:', error.message);
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

    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Verify email address' })
    @ApiResponse({ status: 200, description: 'Email successfully verified' })
    @ApiResponse({ status: 400, description: 'Invalid or expired token' })
    async verifyEmail(@Body() body: { token: string }) {
        return this.authService.verifyEmail(body.token);
    }

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Resend email verification' })
    @ApiResponse({ status: 200, description: 'Verification email sent' })
    @ApiResponse({ status: 400, description: 'User not found or email already verified' })
    async resendVerification(@Body() body: { email: string }) {
        return this.authService.resendVerificationEmail(body.email);
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Request password reset for applicant' })
    @ApiResponse({ status: 200, description: 'Password reset email sent' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async forgotPassword(@Body() body: { email: string }) {
        return this.authService.forgotPassword(body.email);
    }

    // Staff authentication endpoints
    @Post('staff/login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Staff login' })
    @ApiResponse({ status: 200, description: 'Staff successfully logged in' })
    @ApiResponse({ status: 401, description: 'Invalid staff credentials' })
    async staffLogin(@Body() loginDto: LoginDto) {
        return this.authService.staffLogin(loginDto);
    }

    @Get('staff/profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current staff profile' })
    @ApiResponse({ status: 200, description: 'Staff profile retrieved' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getStaffProfile(@Request() req) {
        this.logger.log('Staff profile controller called - user:', {
            userId: req.user?._id,
            email: req.user?.email,
            role: req.user?.role
        });

        try {
            const result = await this.authService.getStaffProfile(req.user._id);
            this.logger.log('Staff profile service result:', {
                success: result.success,
                hasUser: !!result.data?.user
            });
            return result;
        } catch (error) {
            this.logger.error('Staff profile controller error:', error.message);
            throw error;
        }
    }
}

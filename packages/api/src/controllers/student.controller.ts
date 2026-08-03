import { Controller, Get, Put, Post, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StudentService } from '../services/student.service';
import { TenancyAgreementService } from '../services/tenancy-agreement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../schemas/user.schema';

@ApiTags('Student')
@Controller('student')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentController {
    private readonly logger = new Logger(StudentController.name);

    constructor(
        private readonly studentService: StudentService,
        private readonly tenancyAgreementService: TenancyAgreementService
    ) { }

    @Get('profile')
    @ApiOperation({ summary: 'Get current student profile (Student-centric data)' })
    @ApiResponse({ status: 200, description: 'Student profile retrieved successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Student record not found' })
    async getProfile(@Request() req) {
        this.logger.log('Student profile endpoint called - user:', {
            userId: req.user?._id,
            email: req.user?.email,
            role: req.user?.role
        });

        // Verify user is a student
        if (req.user?.role !== UserRole.STUDENT) {
            this.logger.warn('Non-student user attempted to access student profile:', {
                userId: req.user?._id,
                role: req.user?.role
            });
            throw new Error('Access denied. This endpoint is for students only.');
        }

        try {
            const result = await this.studentService.getStudentProfile(req.user._id);

            this.logger.log('Student profile service result:', {
                success: result.success,
                hasStudent: !!result.data?.student,
                hasUser: !!result.data?.user,
                hasApplication: !!result.data?.application,
                matriculationNumber: result.data?.student?.matriculationNumber
            });

            return result;

        } catch (error) {
            this.logger.error('Student profile controller error:', error.message);
            throw error;
        }
    }

    @Put('profile')
    @ApiOperation({ summary: 'Update current student profile' })
    @ApiResponse({ status: 200, description: 'Student profile updated successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Student record not found' })
    async updateProfile(@Body() updates: any, @Request() req) {
        this.logger.log('Student profile update requested:', {
            userId: req.user?._id,
            updates: Object.keys(updates)
        });

        // Verify user is a student
        if (req.user?.role !== UserRole.STUDENT) {
            throw new Error('Access denied. This endpoint is for students only.');
        }

        try {
            const result = await this.studentService.updateStudentProfile(req.user._id, updates);

            this.logger.log('Student profile updated successfully:', {
                userId: req.user._id,
                success: result.success
            });

            return result;

        } catch (error) {
            this.logger.error('Student profile update error:', error.message);
            throw error;
        }
    }

    @Get('check-record')
    @ApiOperation({ summary: 'Check if current user has a student record' })
    @ApiResponse({ status: 200, description: 'Student record check completed' })
    async checkStudentRecord(@Request() req) {
        try {
            const hasRecord = await this.studentService.hasStudentRecord(req.user._id);

            return {
                success: true,
                data: {
                    hasStudentRecord: hasRecord,
                    userId: req.user._id,
                    userRole: req.user.role
                }
            };

        } catch (error) {
            this.logger.error('Student record check error:', error.message);
            throw error;
        }
    }

    // Tenancy Agreement Endpoints

    @Post('tenancy-agreement/submit')
    @ApiOperation({ summary: 'Submit tenancy agreement' })
    @ApiResponse({ status: 201, description: 'Tenancy agreement submitted successfully' })
    @ApiResponse({ status: 400, description: 'Invalid data or already signed' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async submitTenancyAgreement(@Request() req, @Body() agreementData: any) {
        this.logger.log('Tenancy agreement submission endpoint called for user:', req.user?._id);

        // Verify user is a student
        if (req.user?.role !== UserRole.STUDENT) {
            throw new Error('Access denied. This endpoint is for students only.');
        }

        try {
            const result = await this.tenancyAgreementService.submitTenancyAgreement(
                req.user._id,
                agreementData
            );

            this.logger.log('Tenancy agreement submitted successfully for user:', req.user._id);
            return result;

        } catch (error) {
            this.logger.error('Tenancy agreement submission error:', error.message);
            throw error;
        }
    }

    @Get('tenancy-agreement/status')
    @ApiOperation({ summary: 'Get tenancy agreement status' })
    @ApiResponse({ status: 200, description: 'Tenancy agreement status retrieved' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getTenancyAgreementStatus(@Request() req) {
        this.logger.log('Tenancy agreement status endpoint called for user:', req.user?._id);

        // Verify user is a student
        if (req.user?.role !== UserRole.STUDENT) {
            throw new Error('Access denied. This endpoint is for students only.');
        }

        try {
            const result = await this.tenancyAgreementService.getTenancyAgreementStatus(req.user._id);
            return result;

        } catch (error) {
            this.logger.error('Tenancy agreement status error:', error.message);
            throw error;
        }
    }

    @Get('tenancy-agreement/document')
    @ApiOperation({ summary: 'Get tenancy agreement document' })
    @ApiResponse({ status: 200, description: 'Tenancy agreement document retrieved' })
    @ApiResponse({ status: 404, description: 'Document not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getTenancyAgreementDocument(@Request() req) {
        this.logger.log('Tenancy agreement document endpoint called for user:', req.user?._id);

        // Verify user is a student
        if (req.user?.role !== UserRole.STUDENT) {
            throw new Error('Access denied. This endpoint is for students only.');
        }

        try {
            const result = await this.tenancyAgreementService.getTenancyAgreementDocument(req.user._id);
            return result;

        } catch (error) {
            this.logger.error('Tenancy agreement document error:', error.message);
            throw error;
        }
    }
}
import { Controller, Get, Put, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StudentService } from '../services/student.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../schemas/user.schema';

@ApiTags('Student')
@Controller('student')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentController {
    private readonly logger = new Logger(StudentController.name);

    constructor(private readonly studentService: StudentService) { }

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
}
import { Body, Controller, Get, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertCourseRegistrationDraftDto, SubmitCourseRegistrationDto } from '../dto/course-registration.dto';
import { CourseRegistrationService } from '../services/course-registration.service';
import { UserRole } from '../schemas/user.schema';

@ApiTags('Student Course Registration')
@Controller('student/course-registration')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentCourseRegistrationController {
    constructor(private readonly courseRegistrationService: CourseRegistrationService) { }

    @Get()
    @ApiOperation({ summary: 'Get course registration context for the current student' })
    @ApiResponse({ status: 200, description: 'Course registration context retrieved successfully' })
    async getRegistrationContext(@Request() req, @Query('level') level?: string, @Query('semester') semester?: string) {
        this.ensureStudentRole(req.user);
        return this.courseRegistrationService.getRegistrationContext(
            req.user._id,
            level ? Number(level) : undefined,
            semester ? Number(semester) : undefined,
        );
    }

    @Put('draft')
    @ApiOperation({ summary: 'Save course registration draft for the current student' })
    @ApiResponse({ status: 200, description: 'Course registration draft saved successfully' })
    async saveDraft(@Request() req, @Body() payload: UpsertCourseRegistrationDraftDto) {
        this.ensureStudentRole(req.user);
        return this.courseRegistrationService.saveDraft(req.user._id, payload);
    }

    @Post('submit')
    @ApiOperation({ summary: 'Submit course registration for the current student' })
    @ApiResponse({ status: 200, description: 'Course registration submitted successfully' })
    async submit(@Request() req, @Body() payload: SubmitCourseRegistrationDto) {
        this.ensureStudentRole(req.user);
        return this.courseRegistrationService.submit(req.user._id, payload);
    }

    private ensureStudentRole(user: { role?: string }) {
        if (user?.role !== UserRole.STUDENT) {
            throw new Error('Access denied. This endpoint is for students only.');
        }
    }
}

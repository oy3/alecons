import { Body, Controller, Get, Param, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../schemas/user.schema';
import { CourseRegistrationService } from '../services/course-registration.service';
import { ReviewCourseRegistrationDto } from '../dto/course-registration.dto';

@ApiTags('Staff Course Registrations')
@Controller('staff/course-registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffCourseRegistrationsController {
    constructor(private readonly courseRegistrationService: CourseRegistrationService) { }

    @Get('programs')
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    @ApiOperation({ summary: 'Get programs accessible for course registration management' })
    @ApiResponse({ status: 200, description: 'Advisor programs retrieved successfully' })
    async getAdvisorPrograms(@Request() req: any) {
        return this.courseRegistrationService.getAdvisorPrograms(this.getCurrentUserId(req));
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    @ApiOperation({ summary: 'Get accessible course registrations with stats and filters' })
    @ApiResponse({ status: 200, description: 'Course registrations retrieved successfully' })
    async getAdvisorRegistrations(
        @Request() req: any,
        @Query('programId') programId?: string,
        @Query('search') search?: string,
        @Query('state') state?: string,
        @Query('level') level?: string,
        @Query('semester') semester?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.courseRegistrationService.getAdvisorCourseRegistrations(this.getCurrentUserId(req), {
            programId,
            search,
            state,
            level: level ? Number(level) : undefined,
            semester: semester ? Number(semester) : undefined,
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    @ApiOperation({ summary: 'Get a single course registration for review' })
    @ApiResponse({ status: 200, description: 'Course registration retrieved successfully' })
    async getAdvisorRegistrationById(@Request() req: any, @Param('id') id: string) {
        return this.courseRegistrationService.getAdvisorCourseRegistrationById(this.getCurrentUserId(req), id);
    }

    @Patch(':id/approve')
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    @ApiOperation({ summary: 'Approve a submitted course registration' })
    @ApiResponse({ status: 200, description: 'Course registration approved successfully' })
    async approveRegistration(
        @Request() req: any,
        @Param('id') id: string,
        @Body() payload: ReviewCourseRegistrationDto,
    ) {
        return this.courseRegistrationService.approveAdvisorCourseRegistration(
            this.getCurrentUserId(req),
            id,
            payload?.reviewComment,
        );
    }

    @Patch(':id/reject')
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    @ApiOperation({ summary: 'Reject a submitted course registration' })
    @ApiResponse({ status: 200, description: 'Course registration rejected successfully' })
    async rejectRegistration(
        @Request() req: any,
        @Param('id') id: string,
        @Body() payload: ReviewCourseRegistrationDto,
    ) {
        return this.courseRegistrationService.rejectAdvisorCourseRegistration(
            this.getCurrentUserId(req),
            id,
            payload?.reviewComment,
        );
    }

    private getCurrentUserId(req: any) {
        return req?.user?._id?.toString?.() || req?.user?.id?.toString?.() || req?.user?.sub?.toString?.();
    }
}

import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcademicSessionsService } from '../services/academic-sessions.service';

@ApiTags('Student Portal Academic Sessions')
@Controller('student/academic-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StudentAcademicSessionsController {
    private readonly logger = new Logger(StudentAcademicSessionsController.name);

    constructor(private readonly academicSessionsService: AcademicSessionsService) { }

    @Get()
    @ApiOperation({ summary: 'Get academic sessions available for students (excludes draft status)' })
    @ApiResponse({ status: 200, description: 'Academic sessions retrieved successfully' })
    async getAcademicSessions(
        @Query('active') active?: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10
    ) {
        try {
            // Students should only see non-draft academic sessions
            const query: any = {
                status: { $ne: 'draft' }, // Exclude draft sessions
                page: Number(page),
                limit: Number(limit)
            };

            if (active !== undefined) {
                query.active = active === 'true';
            }

            const result = await this.academicSessionsService.findAll(query);

            return {
                success: true,
                data: result
            };
        } catch (error) {
            this.logger.error('Error getting academic sessions for student:', error);
            return {
                success: false,
                message: error.message || 'Failed to fetch academic sessions'
            };
        }
    }
}
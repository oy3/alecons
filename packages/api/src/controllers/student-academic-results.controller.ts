import { Controller, ForbiddenException, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../schemas/user.schema';
import { StudentAcademicResultsService } from '../services/student-academic-results.service';

@ApiTags('Student Academic Results')
@ApiBearerAuth()
@Controller('student/academic-results')
@UseGuards(JwtAuthGuard)
export class StudentAcademicResultsController {
    constructor(private readonly resultsService: StudentAcademicResultsService) {}

    @Get()
    async getPublishedResults(@Request() req: any, @Query('academicSessionId') academicSessionId?: string, @Query('semester') semester?: string) {
        if (req.user?.role !== UserRole.STUDENT) throw new ForbiddenException('This endpoint is for students only.');
        return { success: true, data: await this.resultsService.getPublishedResults(req.user._id.toString(), { academicSessionId, semester: semester ? Number(semester) : undefined }) };
    }
}

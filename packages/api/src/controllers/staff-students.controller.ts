import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffStudentsService } from '../services/staff-students.service';

@ApiTags('Staff Students')
@ApiBearerAuth()
@Controller('staff/students')
@UseGuards(JwtAuthGuard)
export class StaffStudentsController {
    constructor(private readonly staffStudentsService: StaffStudentsService) {}

    @Get()
    async getStudents(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('search') search?: string,
        @Query('programId') programId?: string,
        @Query('programTypeId') programTypeId?: string,
        @Query('programModeId') programModeId?: string,
        @Query('level') level?: string,
        @Query('status') status?: string,
        @Query('portalAccess') portalAccess?: string,
    ) {
        return {
            success: true,
            data: await this.staffStudentsService.getStudents({
                page: Number(page),
                limit: Number(limit),
                search,
                programId,
                programTypeId,
                programModeId,
                level,
                status,
                portalAccess,
            }),
        };
    }

    @Get('stats')
    async getStats(
        @Query('programId') programId?: string,
        @Query('programTypeId') programTypeId?: string,
        @Query('programModeId') programModeId?: string,
        @Query('level') level?: string,
        @Query('status') status?: string,
        @Query('portalAccess') portalAccess?: string,
    ) {
        return {
            success: true,
            data: await this.staffStudentsService.getStats({
                programId,
                programTypeId,
                programModeId,
                level,
                status,
                portalAccess,
            }),
        };
    }

    @Get('filter-options')
    async getFilterOptions() {
        return { success: true, data: await this.staffStudentsService.getFilterOptions() };
    }

    @Get(':id')
    async getStudent(@Param('id') id: string) {
        return { success: true, data: await this.staffStudentsService.getStudentById(id) };
    }

    @Patch(':id/status')
    async updateStudentStatus(@Param('id') id: string, @Body() body: { status?: string }) {
        if (!body.status) throw new BadRequestException('Student status is required');
        return { success: true, data: await this.staffStudentsService.updateStudentStatus(id, body.status) };
    }

    @Patch(':id/portal-access')
    async updatePortalAccess(@Param('id') id: string, @Body() body: { isActive?: boolean }) {
        if (typeof body.isActive !== 'boolean') throw new BadRequestException('isActive must be a boolean');
        return { success: true, data: await this.staffStudentsService.updatePortalAccess(id, body.isActive) };
    }
}

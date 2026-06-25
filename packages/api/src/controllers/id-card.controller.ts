import {
    Body,
    Controller,
    Get,
    Logger,
    Param,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IdCardService, IdCardExportParams } from '../services/id-card.service';

@ApiTags('ID Cards')
@Controller('staff/id-cards')
@UseGuards(JwtAuthGuard)
export class IdCardController {
    private readonly logger = new Logger(IdCardController.name);

    constructor(private readonly idCardService: IdCardService) { }

    // -------------------------------------------------------------------------
    // Filter lookups
    // -------------------------------------------------------------------------

    @Get('filters/program-types')
    @ApiOperation({ summary: 'List all active program types for ID card filters' })
    async getProgramTypes() {
        const data = await this.idCardService.getProgramTypes();
        return { success: true, data };
    }

    @Get('filters/program-modes')
    @ApiOperation({ summary: 'List all active program modes for ID card filters' })
    async getProgramModes() {
        const data = await this.idCardService.getProgramModes();
        return { success: true, data };
    }

    @Get('filters/programs')
    @ApiOperation({ summary: 'List programs, optionally filtered by type and mode' })
    @ApiQuery({ name: 'programTypeId', required: false })
    @ApiQuery({ name: 'programModeId', required: false })
    async getPrograms(
        @Query('programTypeId') programTypeId?: string,
        @Query('programModeId') programModeId?: string,
    ) {
        const data = await this.idCardService.getPrograms({ programTypeId, programModeId });
        return { success: true, data };
    }

    @Get('filters/departments')
    @ApiOperation({ summary: 'List all departments for ID card filters' })
    async getDepartments() {
        const data = await this.idCardService.getDepartments();
        return { success: true, data };
    }

    @Get('filters/staff-departments')
    @ApiOperation({ summary: 'List distinct staff departments for ID card filters' })
    async getStaffDepartments() {
        const data = await this.idCardService.getStaffDepartments();
        return { success: true, data };
    }

    // -------------------------------------------------------------------------
    // Entity selectors
    // -------------------------------------------------------------------------

    @Get('students')
    @ApiOperation({ summary: 'List active students, optionally filtered by program and level' })
    @ApiQuery({ name: 'programId', required: false })
    @ApiQuery({ name: 'level', required: false, type: Number })
    async getStudents(
        @Query('programId') programId?: string,
        @Query('level') level?: string,
    ) {
        const data = await this.idCardService.getStudents({
            programId,
            level: level ? parseInt(level, 10) : undefined,
        });
        return { success: true, data };
    }

    @Get('staff')
    @ApiOperation({ summary: 'List active staff, optionally filtered by department' })
    @ApiQuery({ name: 'department', required: false })
    async getStaff(@Query('department') department?: string) {
        const data = await this.idCardService.getStaff({ department });
        return { success: true, data };
    }

    // -------------------------------------------------------------------------
    // Card data for preview
    // -------------------------------------------------------------------------

    @Get('student/:studentId/preview-data')
    @ApiOperation({ summary: 'Get fully populated student card data for preview' })
    @ApiResponse({ status: 200, description: 'Student card data retrieved' })
    @ApiResponse({ status: 404, description: 'Student not found' })
    async getStudentCardData(@Param('studentId') studentId: string) {
        this.logger.log(`Student card data requested for ${studentId}`);
        const data = await this.idCardService.getStudentCardData(studentId);
        return { success: true, data };
    }

    @Get('staff/:staffId/preview-data')
    @ApiOperation({ summary: 'Get fully populated staff card data for preview' })
    @ApiResponse({ status: 200, description: 'Staff card data retrieved' })
    @ApiResponse({ status: 404, description: 'Staff not found' })
    async getStaffCardData(@Param('staffId') staffId: string) {
        this.logger.log(`Staff card data requested for ${staffId}`);
        const data = await this.idCardService.getStaffCardData(staffId);
        return { success: true, data };
    }

    // -------------------------------------------------------------------------
    // Generation log
    // -------------------------------------------------------------------------

    @Get('log/:userId')
    @ApiOperation({ summary: 'Get ID card generation history for a user' })
    async getGenerationLog(@Param('userId') userId: string) {
        const data = await this.idCardService.getGenerationLog(userId);
        return { success: true, data };
    }

    // -------------------------------------------------------------------------
    // Export
    // -------------------------------------------------------------------------

    @Post('export')
    @ApiOperation({ summary: 'Generate and download an ID card as PNG or PDF' })
    @ApiResponse({ status: 200, description: 'ID card file returned as binary' })
    async exportIdCard(
        @Body() body: {
            entityType: 'student' | 'staff';
            entityId: string;
            side: 'front' | 'back' | 'both';
            format: 'pdf' | 'png';
            dateOfIssue: string;
            validUntil?: string;
            dateOfBirth?: string;
            overridePhotoDataUrl?: string;
        },
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const generatedByUserId = (req as any).user?.sub ?? (req as any).user?.userId ?? 'unknown';

        this.logger.log(`ID card export requested: ${body.entityType} ${body.entityId} side=${body.side} format=${body.format}`);

        const params: IdCardExportParams = {
            entityType: body.entityType,
            entityId: body.entityId,
            side: body.side,
            format: body.format,
            dateOfIssue: body.dateOfIssue,
            validUntil: body.validUntil,
            dateOfBirth: body.dateOfBirth,
            overridePhotoDataUrl: body.overridePhotoDataUrl,
            generatedByUserId,
        };

        const buffer = await this.idCardService.exportIdCard(params);

        const isPng = body.format === 'png';
        const sideLabel = body.side;
        const fileName = isPng
            ? `id-card-${sideLabel}-${body.entityId}.png`
            : `id-card-${body.entityId}.pdf`;

        res.setHeader('Content-Type', isPng ? 'image/png' : 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length.toString());
        return res.send(buffer);
    }
}

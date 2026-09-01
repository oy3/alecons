import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateScheduledReportDto, ExportReportDto, ReportQueryDto, ReportRequestQueryDto, UpdateScheduledReportDto } from '../dto/report.dto';
import { ReportExportService } from '../services/report-export.service';
import { ReportsAccessService } from '../services/reports-access.service';
import { ReportsService } from '../services/reports.service';
import { ScheduledReportsService } from '../services/scheduled-reports.service';
import { StudentFeeObligationService } from '../services/student-fee-obligation.service';

const REPORT_PERMISSIONS: Record<string, string> = {
  overview: 'view', admissions: 'view_admissions', students: 'view_students', finance: 'view_finance',
  academics: 'view_academics', exams: 'view_exams', communications: 'view_communications', activity: 'view_activity',
};

@ApiTags('Staff Reports and Analytics')
@ApiBearerAuth()
@Controller('staff/reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly access: ReportsAccessService,
    private readonly exports: ReportExportService,
    private readonly schedules: ScheduledReportsService,
    private readonly obligations: StudentFeeObligationService,
  ) {}

  private userId(req: any) { return String(req.user?._id || req.user?.id || req.user?.sub); }

  @Get('filter-options')
  async filterOptions(@Request() req: any) {
    const scope = await this.access.assertAnyPermission(this.userId(req), Object.values(REPORT_PERMISSIONS));
    return { success: true, data: await this.reports.getFilterOptions(scope) };
  }

  @Get('website')
  async website(@Request() req: any, @Query() query: ReportQueryDto) {
    await this.access.assertPermission(this.userId(req), 'view_activity');
    return { success: true, data: await this.reports.websiteAnalytics(query) };
  }

  @Get('exports')
  async exportHistory(@Request() req: any, @Query('page') page = '1', @Query('limit') limit = '20') {
    const userId = this.userId(req);
    await this.access.assertPermission(userId, 'export');
    return { success: true, data: await this.exports.history(userId, await this.access.canManage(userId), Number(page), Number(limit)) };
  }

  @Post('export')
  async export(@Request() req: any, @Body() payload: ExportReportDto, @Res() response: Response) {
    const userId = this.userId(req);
    const permission = REPORT_PERMISSIONS[payload.reportType];
    if (!permission) throw new BadRequestException('Unsupported report type');
    const scope = await this.access.assertPermission(userId, permission);
    await this.access.assertPermission(userId, 'export');
    const generated = await this.exports.generate(userId, payload, scope, {
      ip: req.ip, userAgent: req.headers['user-agent'],
    });
    response.setHeader('Content-Type', generated.contentType);
    response.setHeader('Content-Disposition', `attachment; filename="${generated.filename}"`);
    response.setHeader('X-Report-Row-Count', String(generated.rowCount));
    response.send(generated.buffer);
  }

  @Get('schedules')
  async listSchedules(@Request() req: any) {
    const userId = this.userId(req);
    await this.access.assertPermission(userId, 'export');
    return { success: true, data: await this.schedules.list(userId, await this.access.canManage(userId)) };
  }

  @Post('schedules')
  async createSchedule(@Request() req: any, @Body() payload: CreateScheduledReportDto) {
    const permission = REPORT_PERMISSIONS[payload.reportType];
    await this.access.assertPermission(this.userId(req), permission);
    return { success: true, data: await this.schedules.create(this.userId(req), payload) };
  }

  @Patch('schedules/:id')
  async updateSchedule(@Request() req: any, @Param('id') id: string, @Body() payload: UpdateScheduledReportDto) {
    return { success: true, data: await this.schedules.update(this.userId(req), id, payload) };
  }

  @Post('fee-obligations/sync/:academicSessionId')
  async syncFeeObligations(@Request() req: any, @Param('academicSessionId') academicSessionId: string) {
    await this.access.assertPermission(this.userId(req), 'manage');
    return { success: true, data: await this.obligations.syncSession(academicSessionId) };
  }

  @Post('fee-obligations/sync-all')
  async syncAllFeeObligations(@Request() req: any) {
    await this.access.assertUtilityManage(this.userId(req));
    return { success: true, data: await this.obligations.syncAllSessions() };
  }

  @Get(':type')
  async report(
    @Request() req: any,
    @Param('type') type: string,
    @Query() query: ReportRequestQueryDto,
  ) {
    const permission = REPORT_PERMISSIONS[type];
    if (!permission) throw new BadRequestException('Unsupported report type');
    const scope = await this.access.assertPermission(this.userId(req), permission);
    const { refresh, ...filters } = query;
    return { success: true, data: await this.reports.getReport(type as any, filters, scope, refresh === 'true') };
  }
}

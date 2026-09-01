import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateScheduledReportDto, UpdateScheduledReportDto } from '../dto/report.dto';
import { ScheduledReport, ScheduledReportDocument } from '../schemas/scheduled-report.schema';
import { EmailService } from './email.service';
import { ReportExportService } from './report-export.service';
import { ReportsAccessService } from './reports-access.service';

@Injectable()
export class ScheduledReportsService {
  constructor(
    @InjectModel(ScheduledReport.name) private readonly scheduleModel: Model<ScheduledReportDocument>,
    private readonly access: ReportsAccessService,
    private readonly exports: ReportExportService,
    private readonly email: EmailService,
  ) {}

  async list(userId: string, unrestricted: boolean) {
    const query = unrestricted ? {} : { createdBy: new Types.ObjectId(userId) };
    return this.scheduleModel.find(query).populate('createdBy', 'firstName otherName lastName email').sort({ createdAt: -1 }).lean();
  }

  async create(userId: string, payload: CreateScheduledReportDto) {
    await this.access.assertPermission(userId, 'export');
    const nextRunAt = this.nextRun(payload);
    return this.scheduleModel.create({
      name: payload.name.trim(), reportType: payload.reportType, format: payload.format,
      filters: this.filters(payload), frequency: payload.frequency, dayOfWeek: payload.dayOfWeek,
      dayOfMonth: payload.dayOfMonth, time: payload.time, timezone: 'Africa/Lagos', recipients: [...new Set(payload.recipients.map((item) => item.toLowerCase()))],
      active: true, createdBy: new Types.ObjectId(userId), updatedBy: new Types.ObjectId(userId), nextRunAt, lastRunStatus: 'idle',
    });
  }

  async update(userId: string, id: string, payload: UpdateScheduledReportDto) {
    await this.access.assertPermission(userId, 'export');
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid schedule');
    const schedule = await this.scheduleModel.findById(id);
    if (!schedule) throw new NotFoundException('Scheduled report not found');
    if (String(schedule.createdBy) !== userId && !(await this.access.canManage(userId))) {
      throw new ForbiddenException('You can only update your own scheduled reports');
    }
    if (payload.name !== undefined) schedule.name = payload.name.trim();
    if (payload.active !== undefined) schedule.active = payload.active;
    schedule.updatedBy = new Types.ObjectId(userId);
    if (schedule.active && schedule.nextRunAt < new Date()) schedule.nextRunAt = this.nextRun(schedule as any);
    return schedule.save();
  }

  @Cron('0 */5 * * * *')
  async runDue() {
    const due = await this.scheduleModel.find({ active: true, nextRunAt: { $lte: new Date() }, lastRunStatus: { $ne: 'running' } }).limit(20);
    for (const schedule of due) await this.runOne(schedule);
  }

  private async runOne(schedule: ScheduledReportDocument) {
    schedule.lastRunStatus = 'running';
    await schedule.save();
    try {
      const userId = String(schedule.createdBy);
      const permissionByReport: Record<string, string> = {
        overview: 'view', admissions: 'view_admissions', students: 'view_students', finance: 'view_finance',
        academics: 'view_academics', exams: 'view_exams', communications: 'view_communications', activity: 'view_activity',
      };
      const permission = permissionByReport[schedule.reportType];
      if (!permission) throw new BadRequestException('Unsupported scheduled report type');
      const scope = await this.access.assertPermission(userId, permission);
      await this.access.assertPermission(userId, 'export');
      const generated = await this.exports.generate(userId, { reportType: schedule.reportType, format: schedule.format, ...(schedule.filters || {}) } as any, scope);
      await this.email.sendReportEmail(
        schedule.recipients,
        `ALECONS scheduled report: ${schedule.name}`,
        `<p>Your scheduled <strong>${schedule.name}</strong> report is attached.</p>`,
        { filename: generated.filename, content: generated.buffer, contentType: generated.contentType },
      );
      schedule.lastRunStatus = 'success';
      schedule.lastError = undefined;
    } catch (error) {
      schedule.lastRunStatus = 'failed';
      schedule.lastError = error instanceof Error ? error.message.slice(0, 1000) : 'Scheduled report failed';
    }
    schedule.lastRunAt = new Date();
    schedule.nextRunAt = this.nextRun(schedule as any);
    await schedule.save();
  }

  private filters(payload: any) {
    const excluded = new Set(['name', 'reportType', 'format', 'frequency', 'dayOfWeek', 'dayOfMonth', 'time', 'recipients']);
    return Object.fromEntries(Object.entries(payload).filter(([key, value]) => !excluded.has(key) && value !== undefined && value !== ''));
  }

  private nextRun(value: { frequency: string; time: string; dayOfWeek?: number; dayOfMonth?: number }) {
    const [hour, minute] = String(value.time || '08:00').split(':').map(Number);
    const now = new Date();
    const lagosWallClock = new Date(now.getTime() + 60 * 60 * 1000);
    const year = lagosWallClock.getUTCFullYear();
    const month = lagosWallClock.getUTCMonth();
    const day = lagosWallClock.getUTCDate();
    const atLagosTime = (targetYear: number, targetMonth: number, targetDay: number) =>
      new Date(Date.UTC(targetYear, targetMonth, targetDay, hour - 1, minute, 0, 0));
    let next = atLagosTime(year, month, day);
    if (value.frequency === 'daily') {
      if (next <= now) next = atLagosTime(year, month, day + 1);
    }
    else if (value.frequency === 'weekly') {
      const target = Number(value.dayOfWeek ?? 1);
      let days = (target - lagosWallClock.getUTCDay() + 7) % 7;
      if (days === 0 && next <= now) days = 7;
      next = atLagosTime(year, month, day + days);
    } else {
      const targetDay = Math.min(28, Number(value.dayOfMonth || 1));
      next = atLagosTime(year, month, targetDay);
      if (next <= now) next = atLagosTime(year, month + 1, targetDay);
    }
    return next;
  }
}

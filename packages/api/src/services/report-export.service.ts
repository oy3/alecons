import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { ExportReportDto } from '../dto/report.dto';
import { ReportExportAudit, ReportExportAuditDocument } from '../schemas/report-export-audit.schema';
import { ReportAccessScope } from './reports-access.service';
import { ReportsService } from './reports.service';

@Injectable()
export class ReportExportService {
  constructor(
    @InjectModel(ReportExportAudit.name) private readonly auditModel: Model<ReportExportAuditDocument>,
    private readonly reportsService: ReportsService,
  ) {}

  async generate(actorUserId: string, payload: ExportReportDto, scope: ReportAccessScope, requestMeta: { ip?: string; userAgent?: string } = {}) {
    const rows = this.safeRows(await this.reportsService.rowsForExport(payload.reportType as any, payload, scope));
    const filename = `alecons-${payload.reportType}-report-${new Date().toISOString().slice(0, 10)}.${payload.format}`;
    let buffer: Buffer;
    let contentType: string;
    if (payload.format === 'pdf') {
      buffer = await this.pdf(payload.reportType, rows);
      contentType = 'application/pdf';
    } else {
      const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ message: 'No report data matched the selected filters' }]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      if (payload.format === 'csv') {
        buffer = Buffer.from(XLSX.utils.sheet_to_csv(worksheet), 'utf8');
        contentType = 'text/csv; charset=utf-8';
      } else {
        buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }
    }
    await this.auditModel.create({
      actorUserId: new Types.ObjectId(actorUserId), reportType: payload.reportType, format: payload.format,
      filters: this.filterPayload(payload), rowCount: rows.length, ipAddress: requestMeta.ip, userAgent: requestMeta.userAgent,
    });
    return { buffer, filename, contentType, rowCount: rows.length };
  }

  async history(actorUserId: string, unrestricted: boolean, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const query = unrestricted ? {} : { actorUserId: new Types.ObjectId(actorUserId) };
    const [items, total] = await Promise.all([
      this.auditModel.find(query).populate('actorUserId', 'firstName otherName lastName email').sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
      this.auditModel.countDocuments(query),
    ]);
    return { items, pagination: { page: safePage, limit: safeLimit, total, pages: Math.max(1, Math.ceil(total / safeLimit)) } };
  }

  private filterPayload(payload: ExportReportDto) {
    const { reportType: _reportType, format: _format, ...filters } = payload as any;
    return filters;
  }

  private safeRows(rows: Record<string, unknown>[]) {
    return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
      if (typeof value === 'string' && /^[=+\-@]/.test(value.trimStart())) return [key, `'${value}`];
      return [key, value];
    })));
  }

  private async pdf(title: string, rows: Record<string, unknown>[]) {
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pageSize: [number, number] = [595.28, 841.89];
    let page = document.addPage(pageSize);
    let y = 800;
    const addHeader = () => {
      page.drawText('ALEBIOSU COLLEGE OF NURSING SCIENCES', { x: 40, y, size: 12, font: bold, color: rgb(0.65, 0.08, 0.08) });
      y -= 24;
      page.drawText(`${this.label(title)} Report`, { x: 40, y, size: 18, font: bold });
      y -= 18;
      page.drawText(`Generated ${new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}`, { x: 40, y, size: 8, font: regular, color: rgb(0.4, 0.4, 0.4) });
      y -= 24;
    };
    addHeader();
    for (const row of rows.slice(0, 1000)) {
      const text = Object.entries(row).map(([key, value]) => `${this.label(key)}: ${String(value ?? '')}`).join(' | ');
      const lines = this.wrap(text, 105);
      if (y - lines.length * 11 < 40) { page = document.addPage(pageSize); y = 800; addHeader(); }
      for (const line of lines) { page.drawText(line, { x: 40, y, size: 8, font: regular }); y -= 11; }
      y -= 4;
    }
    return Buffer.from(await document.save());
  }

  private wrap(value: string, max: number) {
    const words = value.replace(/[^\x20-\x7E]/g, '').split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (`${current} ${word}`.trim().length > max) { if (current) lines.push(current); current = word.slice(0, max); }
      else current = `${current} ${word}`.trim();
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  private label(value: string) {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

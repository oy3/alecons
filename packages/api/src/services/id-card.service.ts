import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import * as QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { JSDOM } from 'jsdom';
import { PDFDocument } from 'pdf-lib';
import { launchPuppeteerBrowser } from '../utils/puppeteer-launch.util';
import { Student, StudentDocument } from '../schemas/student.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { ProgramMode, ProgramModeDocument } from '../schemas/program-mode.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import {
    IdCardLog,
    IdCardLogDocument,
    IdCardEntityType,
} from '../schemas/id-card-log.schema';

export type IdCardFormat = 'pdf' | 'png';
export type IdCardSide = 'front' | 'back' | 'both';

export interface StudentCardData {
    type: 'student';
    studentId: string;
    userId: string;
    photoUrl: string | null;
    formattedName: string;
    matricNumber: string;
    normalizedMatric: string;
    department: string;
    programme: string;
    entrySession: string;
    publicVerificationToken: string | null;
    verificationUrl: string | null;
}

export interface StaffCardData {
    type: 'staff';
    staffDbId: string;
    userId: string;
    photoUrl: string | null;
    formattedName: string;
    staffId: string;
    normalizedStaffId: string;
    designation: string;
    department: string;
    publicVerificationToken: string | null;
    verificationUrl: string | null;
}

export interface IdCardExportParams {
    entityType: 'student' | 'staff';
    entityId: string;
    side: IdCardSide;
    format: IdCardFormat;
    overridePhotoDataUrl?: string;
    dateOfIssue: string;       // ISO date string
    validUntil?: string;       // ISO date string (student only)
    dateOfBirth?: string;      // ISO date string (staff only)
    generatedByUserId: string;
}

export interface IdCardGenerationParams {
    entityType: 'student' | 'staff';
    entityId: string;
    generatedByUserId: string;
}

// ---------------------------------------------------------------------------
// Card dimensions: 54mm × 85.6mm rendered at 10px/mm = 540×856 viewport
// deviceScaleFactor: 2 for PNG → 1080×1712 output (≈500dpi – excellent print quality)
// ---------------------------------------------------------------------------
const CARD_W = 540;
const CARD_H = 856;
const CARD_SCALE = 2;
const BRAND_RED = '#8B1515';
const BRAND_RED_DARK = '#6E0F0F';

interface FieldStyleConfig {
    fontSizePx?: number;
    fontWeight?: number;
    widthPx?: number;
}

interface IdCardRenderingConfig {
    studentFront?: {
        headerHeightPx?: number;
        personNameSizePx?: number;
        fieldLabel?: FieldStyleConfig;
        fieldValue?: FieldStyleConfig;
        footerWaveHeightPx?: number;
    };
    staffFront?: {
        fieldLabel?: FieldStyleConfig;
        fieldValue?: FieldStyleConfig;
    };
}

const DEFAULT_RENDER_CONFIG: IdCardRenderingConfig = {
    studentFront: {
        headerHeightPx: 140,
        personNameSizePx: 26,
        fieldLabel: {
            fontSizePx: 12,
            fontWeight: 900,
            widthPx: 180,
        },
        fieldValue: {
            fontSizePx: 12,
            fontWeight: 400,
        },
        footerWaveHeightPx: 22,
    },
    staffFront: {
        fieldLabel: {
            fontSizePx: 12,
            fontWeight: 900,
            widthPx: 180,
        },
        fieldValue: {
            fontSizePx: 12,
            fontWeight: 400,
        },
    },
};

const STUDENT_FRONT_RENDER_STYLE = DEFAULT_RENDER_CONFIG.studentFront!;
const STAFF_FRONT_RENDER_STYLE = DEFAULT_RENDER_CONFIG.staffFront!;

@Injectable()
export class IdCardService {
    private readonly logger = new Logger(IdCardService.name);

    constructor(
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
        @InjectModel(ProgramType.name) private readonly programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(ProgramMode.name) private readonly programModeModel: Model<ProgramModeDocument>,
        @InjectModel(AcademicSession.name) private readonly academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
        @InjectModel(IdCardLog.name) private readonly idCardLogModel: Model<IdCardLogDocument>,
    ) { }

    // -------------------------------------------------------------------------
    // Filter helpers
    // -------------------------------------------------------------------------

    async getProgramTypes(): Promise<any[]> {
        return this.programTypeModel.find({ active: true }).select('_id type').sort({ type: 1 }).lean();
    }

    async getProgramModes(): Promise<any[]> {
        return this.programModeModel.find({ active: true }).select('_id mode').sort({ mode: 1 }).lean();
    }

    async getPrograms(filters: { programTypeId?: string; programModeId?: string }): Promise<any[]> {
        const query: any = { active: true };
        if (filters.programTypeId) query.programTypeId = new Types.ObjectId(filters.programTypeId);
        if (filters.programModeId) query.programModeId = new Types.ObjectId(filters.programModeId);
        return this.programModel
            .find(query)
            .select('_id name durationYears programTypeId programModeId')
            .populate('programTypeId', 'type')
            .populate('programModeId', 'mode')
            .sort({ name: 1 })
            .lean();
    }

    async getDepartments(): Promise<any[]> {
        return this.departmentModel.find({ active: true }).select('_id name code').sort({ name: 1 }).lean();
    }

    async getStudents(filters: {
        programId?: string;
        level?: number;
    }): Promise<any[]> {
        const query: any = { isActive: true };
        if (filters.programId) query.programId = new Types.ObjectId(filters.programId);
        if (filters.level) query.currentLevel = filters.level;

        const students = await this.studentModel
            .find(query)
            .select('_id userId matriculationNumber currentLevel programId')
            .populate('userId', 'firstName lastName otherName')
            .populate({
                path: 'programId',
                select: 'name durationYears',
            })
            .sort({ matriculationNumber: 1 })
            .lean();

        return students.map((s) => ({
            _id: s._id,
            userId: s.userId,
            matriculationNumber: s.matriculationNumber,
            currentLevel: s.currentLevel,
            program: s.programId,
            displayName: this.buildStudentDisplayName(s.userId as any),
        }));
    }

    async getStaff(filters: { department?: string }): Promise<any[]> {
        const query: any = { isActive: true };
        if (filters.department) query.department = { $regex: filters.department, $options: 'i' };

        const staffList = await this.staffModel
            .find(query)
            .select('_id userId staffId department position')
            .populate('userId', 'firstName lastName otherName')
            .sort({ staffId: 1 })
            .lean();

        return staffList.map((s) => ({
            _id: s._id,
            userId: s.userId,
            staffId: s.staffId,
            department: s.department,
            position: s.position,
            displayName: this.buildStaffDisplayName(s.userId as any),
        }));
    }

    async getStaffDepartments(): Promise<string[]> {
        const result = await this.staffModel.distinct('department', { isActive: true });
        return (result as string[]).filter(Boolean).sort();
    }

    // -------------------------------------------------------------------------
    // Card data builder
    // -------------------------------------------------------------------------

    async getStudentCardData(studentId: string): Promise<StudentCardData> {
        if (!Types.ObjectId.isValid(studentId)) {
            throw new BadRequestException('Invalid student ID');
        }

        const student = await this.studentModel
            .findById(studentId)
            .populate('userId', 'firstName lastName otherName')
            .populate({
                path: 'programId',
                select: 'name departmentId programTypeId programModeId',
                populate: [
                    { path: 'departmentId', select: 'name' },
                    { path: 'programTypeId', select: 'type' },
                    { path: 'programModeId', select: 'mode' },
                ],
            })
            .populate('entryAcademicSession', 'sessionYear')
            .lean();

        if (!student) throw new NotFoundException('Student not found');
        if (!student.publicVerificationToken) {
            this.logger.warn(`Student ${studentId} has no publicVerificationToken`);
        }

        const user = student.userId as any;
        const program = student.programId as any;
        const entrySession = (student.entryAcademicSession as any)?.sessionYear ?? '';
        const dept = program?.departmentId?.name ?? 'N/A';
        const progType = program?.programTypeId?.type ?? '';
        const progMode = program?.programModeId?.mode ?? '';
        const programme = [progType, progMode, program?.name].filter(Boolean).join(' ');
        const verToken = student.publicVerificationToken ?? null;
        const websiteUrl = String(process.env.WEBSITE_URL || 'https://alecons.edu.ng').replace(/\/$/, '');

        return {
            type: 'student',
            studentId,
            userId: String((student as any).userId?._id ?? student.userId),
            photoUrl: student.profileImageUrl ?? null,
            formattedName: this.buildStudentDisplayName(user),
            matricNumber: student.matriculationNumber,
            normalizedMatric: this.normalizeId(student.matriculationNumber),
            department: dept,
            programme,
            entrySession,
            publicVerificationToken: verToken,
            verificationUrl: verToken ? `${websiteUrl}/verify/v1/${verToken}` : null,
        };
    }

    async getStaffCardData(staffDbId: string): Promise<StaffCardData> {
        if (!Types.ObjectId.isValid(staffDbId)) {
            throw new BadRequestException('Invalid staff ID');
        }

        const staff = await this.staffModel
            .findById(staffDbId)
            .populate('userId', 'firstName lastName otherName profileImageUrl')
            .lean();

        if (!staff) throw new NotFoundException('Staff not found');
        if (!staff.publicVerificationToken) {
            this.logger.warn(`Staff ${staffDbId} has no publicVerificationToken`);
        }

        const user = staff.userId as any;
        const verToken = staff.publicVerificationToken ?? null;
        const websiteUrl = String(process.env.WEBSITE_URL || 'https://alecons.edu.ng').replace(/\/$/, '');

        return {
            type: 'staff',
            staffDbId,
            userId: String(user?._id ?? staff.userId),
            photoUrl: (user as any)?.profileImageUrl ?? null,
            formattedName: this.buildStaffDisplayName(user),
            staffId: staff.staffId,
            normalizedStaffId: this.normalizeId(staff.staffId),
            designation: staff.position ?? 'N/A',
            department: staff.department ?? 'N/A',
            publicVerificationToken: verToken,
            verificationUrl: verToken ? `${websiteUrl}/verify/v1/${verToken}` : null,
        };
    }

    // -------------------------------------------------------------------------
    // Export
    // -------------------------------------------------------------------------

    async exportIdCard(params: IdCardExportParams): Promise<Buffer> {
        const {
            entityType, entityId, side, format,
            overridePhotoDataUrl, dateOfIssue, validUntil, dateOfBirth,
            generatedByUserId,
        } = params;

        // Build card data
        const cardData = entityType === 'student'
            ? await this.getStudentCardData(entityId)
            : await this.getStaffCardData(entityId);

        // Validate: block export if token is missing
        if (!cardData.publicVerificationToken) {
            throw new BadRequestException(
                'Cannot generate ID card: public verification token is not set for this person. ' +
                'Please backfill verification tokens first.',
            );
        }

        // Resolve photo: override > card data > null (gray placeholder)
        const photoSrc = overridePhotoDataUrl
            ?? (cardData.photoUrl ? await this.fetchImageAsBase64(cardData.photoUrl) : null);

        // Load assets
        const logoSrc = this.getAssetBase64('packages/shared/assets/logo.png');
        const signatureSrc = this.getAssetBase64('packages/shared/assets/provost-sign.png');

        // Generate QR + barcode SVGs
        const qrSvg = await this.generateQrSvg(cardData.verificationUrl!);
        const barcode = entityType === 'student'
            ? (cardData as StudentCardData).normalizedMatric
            : (cardData as StaffCardData).normalizedStaffId;
        const barcodeBase64 = this.generateBarcodePng(barcode);

        // Format dates
        const issueDateStr = this.formatCardDate(new Date(dateOfIssue));
        const validUntilStr = validUntil ? this.formatCardDate(new Date(validUntil)) : null;
        const dobStr = dateOfBirth ? this.formatCardDate(new Date(dateOfBirth)) : null;

        let buffer: Buffer;
        if (side === 'both') {
            if (format !== 'pdf') {
                throw new BadRequestException('Both-side export is only supported for PDF format.');
            }

            const frontHtml = entityType === 'student'
                ? this.buildStudentFrontHtml({
                    cardData: cardData as StudentCardData,
                    photoSrc,
                    logoSrc,
                    issueDateStr,
                    validUntilStr: validUntilStr ?? '',
                })
                : this.buildStaffFrontHtml({
                    cardData: cardData as StaffCardData,
                    photoSrc,
                    logoSrc,
                    issueDateStr,
                    dobStr: dobStr ?? '',
                });

            const backHtml = this.buildBackHtml({
                entityType,
                logoSrc,
                signatureSrc,
                qrSvg,
                barcodeBase64,
                barcodeDisplayValue: entityType === 'student'
                    ? (cardData as StudentCardData).matricNumber
                    : (cardData as StaffCardData).staffId,
            });

            const [frontPng, backPng] = await Promise.all([
                this.renderPng(frontHtml),
                this.renderPng(backHtml),
            ]);

            buffer = await this.buildLandscapeBothSidesPdf(frontPng, backPng);
        } else {
            let html: string;
            if (side === 'front') {
                html = entityType === 'student'
                    ? this.buildStudentFrontHtml({
                        cardData: cardData as StudentCardData,
                        photoSrc,
                        logoSrc,
                        issueDateStr,
                        validUntilStr: validUntilStr ?? '',
                    })
                    : this.buildStaffFrontHtml({
                        cardData: cardData as StaffCardData,
                        photoSrc,
                        logoSrc,
                        issueDateStr,
                        dobStr: dobStr ?? '',
                    });
            } else {
                html = this.buildBackHtml({
                    entityType,
                    logoSrc,
                    signatureSrc,
                    qrSvg,
                    barcodeBase64,
                    barcodeDisplayValue: entityType === 'student'
                        ? (cardData as StudentCardData).matricNumber
                        : (cardData as StaffCardData).staffId,
                });
            }

            if (format === 'png') {
                buffer = await this.renderPng(html);
            } else {
                buffer = await this.renderPdf(html);
            }
        }

        // Record in log
        await this.recordGeneration({
            entityType: entityType === 'student' ? IdCardEntityType.STUDENT : IdCardEntityType.STAFF,
            entityId,
            userId: cardData.userId,
            generatedByUserId,
        });

        return buffer;
    }

    async getGenerationLog(userId: string): Promise<IdCardLogDocument | null> {
        if (!Types.ObjectId.isValid(userId)) return null;
        return this.idCardLogModel.findOne({ userId: new Types.ObjectId(userId) }).lean() as any;
    }

    async registerGeneration(params: IdCardGenerationParams): Promise<IdCardLogDocument | null> {
        const { entityType, entityId, generatedByUserId } = params;

        const cardData = entityType === 'student'
            ? await this.getStudentCardData(entityId)
            : await this.getStaffCardData(entityId);

        await this.recordGeneration({
            entityType: entityType === 'student' ? IdCardEntityType.STUDENT : IdCardEntityType.STAFF,
            entityId,
            userId: cardData.userId,
            generatedByUserId,
        });

        return this.getGenerationLog(cardData.userId);
    }

    // -------------------------------------------------------------------------
    // Puppeteer rendering
    // -------------------------------------------------------------------------

    private async renderPng(html: string): Promise<Buffer> {
        let browser = null;
        try {
            browser = await launchPuppeteerBrowser();
            const page = await browser.newPage();
            await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: CARD_SCALE });
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const screenshot = await page.screenshot({
                type: 'png',
                clip: { x: 0, y: 0, width: CARD_W, height: CARD_H },
            });
            return Buffer.from(screenshot);
        } finally {
            if (browser) await browser.close();
        }
    }

    private async renderPdf(html: string): Promise<Buffer> {
        let browser = null;
        try {
            browser = await launchPuppeteerBrowser();
            const page = await browser.newPage();
            await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: 1 });
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBytes = await page.pdf({
                width: '54mm',
                height: '85.6mm',
                printBackground: true,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });
            return Buffer.from(pdfBytes);
        } finally {
            if (browser) await browser.close();
        }
    }

    private async buildLandscapeBothSidesPdf(frontPng: Buffer, backPng: Buffer): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create();

        // A4 landscape page to keep compatibility with common print workflows.
        const pageWidth = 841.89;
        const pageHeight = 595.28;
        const margin = 24;
        const gap = 24;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const frontImage = await pdfDoc.embedPng(frontPng);
        const backImage = await pdfDoc.embedPng(backPng);

        const maxCardHeight = pageHeight - (margin * 2);
        const targetHeight = Math.min(maxCardHeight, frontImage.height);
        const targetWidth = (targetHeight * frontImage.width) / frontImage.height;
        const totalWidth = (targetWidth * 2) + gap;
        const startX = (pageWidth - totalWidth) / 2;
        const y = (pageHeight - targetHeight) / 2;

        page.drawImage(frontImage, {
            x: startX,
            y,
            width: targetWidth,
            height: targetHeight,
        });

        page.drawImage(backImage, {
            x: startX + targetWidth + gap,
            y,
            width: targetWidth,
            height: targetHeight,
        });

        const bytes = await pdfDoc.save();
        return Buffer.from(bytes);
    }

    // -------------------------------------------------------------------------
    // HTML templates
    // -------------------------------------------------------------------------

    private buildStudentFrontHtml(opts: {
        cardData: StudentCardData;
        photoSrc: string | null;
        logoSrc: string | null;
        issueDateStr: string;
        validUntilStr: string;
    }): string {
        const { cardData, photoSrc, logoSrc, issueDateStr, validUntilStr } = opts;
        const studentFront = STUDENT_FRONT_RENDER_STYLE;
        const photoEl = photoSrc
            ? `<img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;" alt="Photo">`
            : `<div style="width:100%;height:100%;background:#d0d0d0;display:flex;align-items:center;justify-content:center;">
                 <svg width="60" height="60" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
               </div>`;

        return this.wrapCardHtml(`
      <div style="width:${CARD_W}px;height:${CARD_H}px;position:relative;background:#fff;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">
                ${this.headerHtml(logoSrc, studentFront.headerHeightPx ?? 140)}
        <!-- Watermark -->
        <div style="position:absolute;right:18px;top:155px;width:240px;height:240px;opacity:0.06;pointer-events:none;z-index:0;">
          ${logoSrc ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;" alt="">` : ''}
        </div>
        <!-- Body -->
        <div style="padding:22px 26px 0;position:relative;z-index:1;">
          <!-- Photo + badge row -->
          <div style="display:flex;align-items:flex-start;gap:18px;">
            <div style="width:220px;height:284px;border:2.5px solid ${BRAND_RED};border-radius:10px;overflow:hidden;flex-shrink:0;background:#e8e8e8;">
              ${photoEl}
            </div>
            <div style="flex:1;padding-top:6px;">
              <div style="background:${BRAND_RED};color:#fff;font-size:13px;font-weight:700;letter-spacing:1.5px;padding:6px 22px;border-radius:20px;text-align:center;display:inline-block;">STUDENT ID</div>
                            <div style="margin-top:16px;font-size:${studentFront.personNameSizePx ?? 26}px;font-weight:900;color:#1a1a1a;line-height:1.2;text-transform:uppercase;word-break:break-word;">${this.escHtml(cardData.formattedName)}</div>
            </div>
          </div>
          <!-- Fields -->
          <div style="margin-top:20px;">
                        ${this.fieldRow('MATRIC NO.:', cardData.matricNumber, studentFront.fieldLabel, studentFront.fieldValue)}
                        ${this.fieldRow('DEPARTMENT:', cardData.department, studentFront.fieldLabel, studentFront.fieldValue)}
                        ${this.fieldRow('PROGRAMME:', cardData.programme, studentFront.fieldLabel, studentFront.fieldValue)}
                        ${this.fieldRow('ENTRY SESSION:', cardData.entrySession, studentFront.fieldLabel, studentFront.fieldValue)}
                        ${this.fieldRow('DATE OF ISSUE:', issueDateStr, studentFront.fieldLabel, studentFront.fieldValue)}
                        ${this.fieldRow('VALID UNTIL:', validUntilStr, studentFront.fieldLabel, studentFront.fieldValue)}
          </div>
        </div>
                ${this.footerHtml(studentFront.footerWaveHeightPx ?? 22)}
      </div>
    `);
    }

    private buildStaffFrontHtml(opts: {
        cardData: StaffCardData;
        photoSrc: string | null;
        logoSrc: string | null;
        issueDateStr: string;
        dobStr: string;
    }): string {
        const { cardData, photoSrc, logoSrc, issueDateStr, dobStr } = opts;
        const staffFront = STAFF_FRONT_RENDER_STYLE;
        const photoEl = photoSrc
            ? `<img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;" alt="Photo">`
            : `<div style="width:100%;height:100%;background:#d0d0d0;display:flex;align-items:center;justify-content:center;">
                 <svg width="60" height="60" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
               </div>`;

        return this.wrapCardHtml(`
      <div style="width:${CARD_W}px;height:${CARD_H}px;position:relative;background:#fff;font-family:Arial,Helvetica,sans-serif;overflow:hidden;">
        ${this.headerHtml(logoSrc)}
        <!-- Watermark -->
        <div style="position:absolute;right:18px;top:155px;width:240px;height:240px;opacity:0.06;pointer-events:none;z-index:0;">
          ${logoSrc ? `<img src="${logoSrc}" style="width:100%;height:100%;object-fit:contain;" alt="">` : ''}
        </div>
        <!-- Body -->
        <div style="padding:22px 26px 0;position:relative;z-index:1;">
          <!-- Photo + badge row -->
          <div style="display:flex;align-items:flex-start;gap:18px;">
            <div style="width:220px;height:270px;border:2.5px solid ${BRAND_RED};border-radius:10px;overflow:hidden;flex-shrink:0;background:#e8e8e8;">
              ${photoEl}
            </div>
            <div style="flex:1;padding-top:6px;">
              <div style="background:${BRAND_RED};color:#fff;font-size:13px;font-weight:700;letter-spacing:1.5px;padding:6px 22px;border-radius:20px;text-align:center;display:inline-block;">STAFF ID</div>
              <div style="margin-top:16px;font-size:26px;font-weight:900;color:#1a1a1a;line-height:1.2;text-transform:uppercase;word-break:break-word;">${this.escHtml(cardData.formattedName)}</div>
              <div style="margin-top:6px;font-size:13px;font-weight:700;color:${BRAND_RED};letter-spacing:0.5px;text-transform:uppercase;">${this.escHtml(cardData.designation)}</div>
            </div>
          </div>
          <!-- Fields -->
          <div style="margin-top:20px;">
                        ${this.fieldRow('STAFF ID NO.:', cardData.staffId, staffFront.fieldLabel, staffFront.fieldValue)}
                        ${this.fieldRow('DESIGNATION:', cardData.designation, staffFront.fieldLabel, staffFront.fieldValue)}
                        ${this.fieldRow('DEPARTMENT:', cardData.department, staffFront.fieldLabel, staffFront.fieldValue)}
                        ${this.fieldRow('DATE OF BIRTH:', dobStr, staffFront.fieldLabel, staffFront.fieldValue)}
                        ${this.fieldRow('DATE OF ISSUE:', issueDateStr, staffFront.fieldLabel, staffFront.fieldValue)}
          </div>
        </div>
        ${this.footerHtml()}
      </div>
    `);
    }

    private buildBackHtml(opts: {
        entityType: 'student' | 'staff';
        logoSrc: string | null;
        signatureSrc: string | null;
        qrSvg: string;
        barcodeBase64: string;
        barcodeDisplayValue: string;
    }): string {
        const { entityType, logoSrc, signatureSrc, qrSvg, barcodeBase64, barcodeDisplayValue } = opts;
        const bearerText = entityType === 'student'
            ? 'This card identifies the bearer as a student of Alebiosu College of Nursing Sciences.'
            : 'This card identifies the bearer as a staff member of Alebiosu College of Nursing Sciences.';

        return this.wrapCardHtml(`
      <div style="width:${CARD_W}px;height:${CARD_H}px;position:relative;font-family:Arial,Helvetica,sans-serif;overflow:hidden;background:repeating-linear-gradient(45deg,#fff,#fff 12px,rgba(0,0,0,0.025) 12px,rgba(0,0,0,0.025) 13px);">
        <!-- Content area (white body above footer) -->
        <div style="position:absolute;top:0;left:0;right:0;bottom:110px;padding:28px 30px 0;">
          <!-- Logo + Title -->
          <div style="text-align:center;margin-bottom:16px;">
            ${logoSrc ? `<img src="${logoSrc}" style="width:68px;height:68px;object-fit:contain;" alt="Logo">` : ''}
            <div style="font-size:18px;font-weight:900;color:${BRAND_RED};letter-spacing:1px;margin-top:8px;">ALEBIOSU COLLEGE</div>
            <div style="font-size:11px;font-weight:400;color:#333;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">OF NURSING SCIENCES</div>
          </div>
          <!-- Divider with dot -->
          <div style="display:flex;align-items:center;margin:0 0 16px;">
            <div style="flex:1;height:1.5px;background:${BRAND_RED};"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:${BRAND_RED};margin:0 6px;flex-shrink:0;"></div>
            <div style="flex:1;height:1.5px;background:${BRAND_RED};"></div>
          </div>
          <!-- Bearer text -->
          <p style="font-size:12.5px;line-height:1.6;color:#1a1a1a;text-align:justify;margin-bottom:14px;">${bearerText}</p>
          <!-- T&C badge -->
          <div style="display:inline-block;background:${BRAND_RED};color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;padding:5px 18px;border-radius:4px;margin-bottom:10px;">TERMS &amp; CONDITIONS</div>
          <!-- Bullets -->
          <ul style="margin:0 0 14px 16px;padding:0;font-size:12px;line-height:1.7;color:#1a1a1a;">
            <li style="text-align:justify;margin-bottom:4px;">This card is the property of Alebiosu College of Nursing Sciences.</li>
            <li style="text-align:justify;margin-bottom:4px;">It is non-transferable and must be presented on demand.</li>
            <li style="text-align:justify;margin-bottom:4px;">Report loss of this card immediately to the College Bursary.</li>
            <li style="text-align:justify;">Misuse of this card is a disciplinary offence.</li>
          </ul>
          <!-- Divider -->
          <div style="height:1px;background:#ccc;margin-bottom:12px;"></div>
          <!-- Contact + QR -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="font-size:11px;line-height:1.9;color:#1a1a1a;">
              <div style="display:flex;align-items:center;gap:6px;"><span style="color:${BRAND_RED};">📍</span> Iyamoye-Abuja Road,<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Omuoke, Ekiti State.</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;"><span style="color:${BRAND_RED};">📞</span> 0708 460 1610</div>
              <div style="display:flex;align-items:center;gap:6px;"><span style="color:${BRAND_RED};">✉</span> info@alecons.edu.ng</div>
              <div style="display:flex;align-items:center;gap:6px;"><span style="color:${BRAND_RED};">🌐</span> www.alecons.edu.ng</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
              <div style="width:90px;height:90px;">${qrSvg}</div>
            </div>
          </div>
          <!-- Signature -->
          <div style="margin-top:8px;display:flex;justify-content:flex-end;">
            <div style="text-align:center;">
              ${signatureSrc ? `<img src="${signatureSrc}" style="height:48px;object-fit:contain;" alt="Signature">` : ''}
              <div style="font-size:10px;font-weight:700;color:${BRAND_RED};letter-spacing:1px;margin-top:2px;">PROVOST</div>
            </div>
          </div>
        </div>
        <!-- Footer wave + barcode area -->
        <div style="position:absolute;bottom:0;left:0;right:0;">
          <!-- Wave top of footer -->
          <svg viewBox="0 0 ${CARD_W} 28" preserveAspectRatio="none" style="display:block;width:100%;height:28px;">
            <path d="M0,28 L0,14 C90,2 180,0 270,12 C360,24 450,20 ${CARD_W},8 L${CARD_W},28 Z" fill="${BRAND_RED}"/>
          </svg>
          <div style="background:${BRAND_RED_DARK};padding:10px 20px 8px;text-align:center;">
            ${barcodeBase64
                ? `<img src="data:image/png;base64,${barcodeBase64}" style="height:34px;background:#fff;padding:2px 8px;display:inline-block;" alt="${this.escHtml(barcodeDisplayValue)}">`
                : `<div style="font-size:10px;font-family:monospace;color:#fff;letter-spacing:3px;">${this.escHtml(barcodeDisplayValue)}</div>`
            }
            <div style="font-size:9px;color:rgba(255,255,255,0.75);letter-spacing:0.5px;margin-top:3px;">IF FOUND, PLEASE RETURN TO THE COLLEGE ADMINISTRATION</div>
          </div>
        </div>
      </div>
    `);
    }

    // -------------------------------------------------------------------------
    // Shared HTML fragments
    // -------------------------------------------------------------------------

        private headerHtml(logoSrc: string | null, headerHeightPx = 140): string {
        return `
            <div style="position:relative;background:${BRAND_RED};height:${headerHeightPx}px;display:flex;align-items:center;padding:16px 22px;">
        ${logoSrc ? `<img src="${logoSrc}" style="width:74px;height:74px;object-fit:contain;z-index:1;flex-shrink:0;" alt="Logo">` : ''}
        <div style="margin-left:14px;z-index:1;">
          <div style="color:#fff;font-size:21px;font-weight:900;letter-spacing:1px;line-height:1.1;">ALEBIOSU COLLEGE</div>
          <div style="color:rgba(255,255,255,0.85);font-size:10.5px;letter-spacing:2px;text-transform:uppercase;margin-top:3px;font-weight:400;">OF NURSING SCIENCES</div>
        </div>
        <!-- Header wave bottom -->
        <svg style="position:absolute;bottom:-1px;left:0;right:0;" viewBox="0 0 ${CARD_W} 28" preserveAspectRatio="none" width="${CARD_W}" height="28">
          <path d="M0,28 L0,8 C90,28 180,32 270,18 C360,4 450,8 ${CARD_W},18 L${CARD_W},28 Z" fill="#fff"/>
        </svg>
      </div>`;
    }

        private footerHtml(footerWaveHeightPx = 22): string {
        return `
      <div style="position:absolute;bottom:0;left:0;right:0;">
                <svg viewBox="0 0 ${CARD_W} 22" preserveAspectRatio="none" style="display:block;width:100%;height:${footerWaveHeightPx}px;">
          <path d="M0,22 L0,12 C90,0 180,-2 270,10 C360,22 450,18 ${CARD_W},6 L${CARD_W},22 Z" fill="${BRAND_RED}"/>
        </svg>
        <div style="background:${BRAND_RED};padding:9px 20px;text-align:center;">
          <span style="color:rgba(255,255,255,0.9);font-size:11px;letter-spacing:2px;font-weight:500;">COMPASSION · KNOWLEGDE · CARE</span>
        </div>
      </div>`;
    }

    private fieldRow(label: string, value: string, labelStyle?: FieldStyleConfig, valueStyle?: FieldStyleConfig): string {
        const resolvedLabel = {
            fontSizePx: labelStyle?.fontSizePx ?? 12,
            fontWeight: labelStyle?.fontWeight ?? 900,
            widthPx: labelStyle?.widthPx ?? 180,
        };
        const resolvedValue = {
            fontSizePx: valueStyle?.fontSizePx ?? 12,
            fontWeight: valueStyle?.fontWeight ?? 400,
        };

        return `
      <div style="display:flex;align-items:baseline;padding:5px 0;font-size:12.5px;">
        <span style="font-weight:${resolvedLabel.fontWeight};color:#1a1a1a;width:${resolvedLabel.widthPx}px;flex-shrink:0;font-size:${resolvedLabel.fontSizePx}px;">${this.escHtml(label)}</span>
        <span style="font-weight:${resolvedValue.fontWeight};color:#1a1a1a;font-size:${resolvedValue.fontSizePx}px;">${this.escHtml(value)}</span>
      </div>`;
    }

    private wrapCardHtml(body: string): string {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{margin:0;padding:0;}</style>
      </head><body>${body}</body></html>`;
    }

    // -------------------------------------------------------------------------
    // QR + barcode generation
    // -------------------------------------------------------------------------

    private async generateQrSvg(url: string): Promise<string> {
        try {
            const svg = await QRCode.toString(url, {
                type: 'svg',
                margin: 1,
                color: { dark: '#1a1a1a', light: '#ffffff' },
            });
            // Remove xml declaration if present
            return svg.replace(/<\?xml[^?]*\?>\s*/i, '').trim();
        } catch (err) {
            this.logger.error('QR generation failed', err);
            return `<svg width="90" height="90" viewBox="0 0 90 90"><rect width="90" height="90" fill="#eee"/><text x="45" y="50" text-anchor="middle" font-size="10" fill="#999">QR</text></svg>`;
        }
    }

    private generateBarcodePng(value: string): string {
        try {
            const dom = new JSDOM('<!DOCTYPE html><body><svg id="bc"></svg></body>');
            const svgEl = dom.window.document.getElementById('bc');
            JsBarcode(svgEl, value, {
                format: 'CODE128',
                displayValue: false,
                margin: 4,
                width: 2,
                height: 40,
                background: '#ffffff',
                lineColor: '#000000',
            });
            // Return the SVG source as base64-encoded PNG (embedded via data URI later)
            // We embed the SVG markup directly as a data URL for PNG output
            const svgStr = dom.window.document.body.innerHTML;
            return Buffer.from(svgStr).toString('base64');
        } catch (err) {
            this.logger.error('Barcode generation failed', err);
            return '';
        }
    }

    // -------------------------------------------------------------------------
    // Asset helpers
    // -------------------------------------------------------------------------

    private getAssetBase64(relPath: string): string | null {
        try {
            // CDN override
            if (process.env.SPACES_CDN_URL) {
                const fileName = path.basename(relPath);
                return `${process.env.SPACES_CDN_URL}/assets/${fileName}`;
            }
            const fullPath = path.join(process.cwd(), relPath);
            if (!fs.existsSync(fullPath)) return null;
            const buf = fs.readFileSync(fullPath);
            const ext = path.extname(relPath).substring(1);
            return `data:image/${ext};base64,${buf.toString('base64')}`;
        } catch {
            return null;
        }
    }

    private async fetchImageAsBase64(url: string): Promise<string | null> {
        try {
            const res = await fetch(url);
            if (!res.ok) return null;
            const buf = Buffer.from(await res.arrayBuffer());
            const ct = res.headers.get('content-type') ?? 'image/jpeg';
            return `data:${ct};base64,${buf.toString('base64')}`;
        } catch {
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Generation log
    // -------------------------------------------------------------------------

    private async recordGeneration(opts: {
        entityType: IdCardEntityType;
        entityId: string;
        userId: string;
        generatedByUserId: string;
    }): Promise<void> {
        const now = new Date();
        try {
            // Validate all IDs are valid ObjectIds before attempting conversion
            if (!Types.ObjectId.isValid(opts.entityId)) {
                throw new Error(`Invalid entityId: ${opts.entityId}`);
            }
            if (!Types.ObjectId.isValid(opts.userId)) {
                throw new Error(`Invalid userId: ${opts.userId}`);
            }
            if (!Types.ObjectId.isValid(opts.generatedByUserId)) {
                throw new Error(`Invalid generatedByUserId: ${opts.generatedByUserId}`);
            }

            await this.idCardLogModel.findOneAndUpdate(
                { entityId: new Types.ObjectId(opts.entityId), entityType: opts.entityType },
                {
                    $set: {
                        userId: new Types.ObjectId(opts.userId),
                        generatedBy: new Types.ObjectId(opts.generatedByUserId),
                        lastGeneratedAt: now,
                    },
                    $setOnInsert: { firstGeneratedAt: now },
                    $inc: { generationCount: 1 },
                },
                { upsert: true, new: true },
            );
        } catch (err) {
            this.logger.error('Failed to record ID card generation log', err);
            // Non-critical: do not throw
        }
    }

    // -------------------------------------------------------------------------
    // Name formatters
    // -------------------------------------------------------------------------

    private buildStudentDisplayName(user: { firstName?: string; lastName?: string; otherName?: string } | null): string {
        if (!user) return '';
        const parts: string[] = [];
        if (user.lastName) parts.push(user.lastName.toUpperCase());
        if (user.firstName) parts.push(user.firstName.toUpperCase());
        if (user.otherName) parts.push(`${user.otherName.charAt(0).toUpperCase()}.`);
        return parts.join(' ');
    }

    private buildStaffDisplayName(user: { firstName?: string; lastName?: string; otherName?: string } | null): string {
        if (!user) return '';
        const parts: string[] = [];
        if (user.lastName) parts.push(user.lastName.toUpperCase());
        if (user.firstName) parts.push(user.firstName.toUpperCase());
        return parts.join(' ');
    }

    // -------------------------------------------------------------------------
    // Utilities
    // -------------------------------------------------------------------------

    private normalizeId(value: string): string {
        return String(value ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }

    private formatCardDate(date: Date): string {
        const day = date.getDate();
        const suffix = this.ordinalSuffix(day);
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        return `${day}${suffix} ${months[date.getMonth()]}, ${date.getFullYear()}`;
    }

    private ordinalSuffix(n: number): string {
        if (n >= 11 && n <= 13) return 'th';
        switch (n % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    private escHtml(str: string | null | undefined): string {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

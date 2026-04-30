import {
    Controller,
    Get,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpException,
    Logger,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Application, ApplicationDocument, ApplicationStatus, AdmissionDecision } from '../schemas/application.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { ProgramType, ProgramTypeDocument } from '../schemas/program-type.schema';
import { AcademicSession, AcademicSessionDocument } from '../schemas/academic-session.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { Student, StudentDocument } from '../schemas/student.schema';
import { EmailService } from '../services/email.service';
import { MatriculationService } from '../services/matriculation.service';
import { AdmissionLetterPdfService } from '../services/admission-letter-pdf.service';
import { UploadService } from '../services/upload.service';
import { SessionControlsService } from '../services/session-controls.service';
import { PaymentsService } from '../payments/payments.service';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

@ApiTags('Staff Applications')
@Controller('staff/applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffApplicationsController {
    private readonly logger = new Logger(StaffApplicationsController.name);

    constructor(
        @InjectModel(Application.name) private applicationModel: Model<ApplicationDocument>,
        @InjectModel(Program.name) private programModel: Model<ProgramDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(ProgramType.name) private programTypeModel: Model<ProgramTypeDocument>,
        @InjectModel(AcademicSession.name) private academicSessionModel: Model<AcademicSessionDocument>,
        @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        private emailService: EmailService,
        private matriculationService: MatriculationService,
        private admissionLetterPdfService: AdmissionLetterPdfService,
        private uploadService: UploadService,
        private sessionControlsService: SessionControlsService,
        private paymentsService: PaymentsService,
    ) { }

    private extractEntityId(value: unknown): string | undefined {
        if (!value) {
            return undefined;
        }

        if (typeof value === 'string') {
            return value;
        }

        if (value instanceof Types.ObjectId) {
            return value.toString();
        }

        if (typeof value === 'object' && value !== null && '_id' in value && (value as any)._id) {
            return (value as any)._id.toString();
        }

        return undefined;
    }

    private async getApplicationAdmissionFlow(application: {
        entryAcademicSession?: Types.ObjectId | { _id?: Types.ObjectId | string } | string;
        currentStage: number;
        save?: () => Promise<unknown>;
        markModified?: (path: string) => void;
    }) {
        return this.sessionControlsService.syncApplicationStageWithControls(application);
    }

    private stageNames: Record<number, string> = {
        1: 'Email Verification',
        2: 'Form Fee Payment',
        3: 'Application Form',
        4: 'Entrance Exam',
        5: 'Admission Decision',
        6: 'Screening & Interview',
        7: 'Acceptance Fee Payment',
        8: 'Sundry Fees Payment',
        9: 'School Fees Payment',
        10: 'Submission Complete',
    };

    private getApplicationStageName(stageNumber?: number): string {
        if (!stageNumber) {
            return 'N/A';
        }
        return this.stageNames[stageNumber] || 'Unknown Stage';
    }

    private getDocumentUrl(document: unknown): string | null {
        if (!document) {
            return null;
        }

        if (typeof document === 'string') {
            return document;
        }

        if (typeof document === 'object' && document !== null && 'url' in document) {
            return (document as any).url || null;
        }

        return null;
    }

    private getAssetKind(url: string, contentType: string): 'pdf' | 'png' | 'jpg' | 'unknown' {
        const normalizedUrl = (url || '').toLowerCase();
        const normalizedType = (contentType || '').toLowerCase();

        if (normalizedType.includes('application/pdf') || normalizedUrl.endsWith('.pdf')) {
            return 'pdf';
        }

        if (normalizedType.includes('image/png') || normalizedUrl.endsWith('.png')) {
            return 'png';
        }

        if (
            normalizedType.includes('image/jpeg') ||
            normalizedType.includes('image/jpg') ||
            normalizedUrl.endsWith('.jpg') ||
            normalizedUrl.endsWith('.jpeg')
        ) {
            return 'jpg';
        }

        return 'unknown';
    }

    private async fetchRemoteAsset(url: string): Promise<{ buffer: Buffer; contentType: string }> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to fetch asset (${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            contentType: (response.headers.get('content-type') || '').toLowerCase(),
        };
    }

    private formatAcademicSession(session: unknown): string {
        if (!session) {
            return 'N/A';
        }

        if (typeof session === 'string') {
            return session;
        }

        if (typeof session === 'object' && session !== null) {
            const sessionYear = (session as any).sessionYear;
            const name = (session as any).name;
            return sessionYear || name || 'N/A';
        }

        return 'N/A';
    }

    private formatApplicantName(application: any): string {
        const firstName = application?.userId?.firstName || '';
        const lastName = application?.userId?.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || 'N/A';
    }

    private formatProgramDisplay(application: any): string {
        const program = application?.programId;
        if (!program) {
            return 'N/A';
        }

        return [
            program?.programTypeId?.type,
            program?.programModeId?.description || program?.programModeId?.mode,
            program?.name,
        ]
            .filter(Boolean)
            .join(' ') || 'N/A';
    }

    private buildExportFilename(application: any): string {
        const name = this.formatApplicantName(application)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        const appNumber = application?.applicationNumber || 'application';
        return `application-details-${name || 'applicant'}-${appNumber}.pdf`;
    }

    private addFallbackDocumentPage(pdfDoc: PDFDocument, title: string, sourceUrl: string) {
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 40;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        page.drawText(`${title} (Could not embed)`, {
            x: margin,
            y: pageHeight - margin,
            size: 12,
            color: rgb(0.55, 0.12, 0.12),
        });

        page.drawText(`Source: ${sourceUrl}`, {
            x: margin,
            y: pageHeight - margin - 20,
            size: 9,
            color: rgb(0.3, 0.3, 0.3),
        });
    }

    private async appendSupportingDocument(pdfDoc: PDFDocument, documentUrl: string, title: string) {
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 40;

        const { buffer, contentType } = await this.fetchRemoteAsset(documentUrl);
        const assetKind = this.getAssetKind(documentUrl, contentType);

        if (assetKind === 'pdf') {
            const sourcePdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
            const sourcePages = await pdfDoc.copyPages(sourcePdf, sourcePdf.getPageIndices());

            sourcePages.forEach((copiedPage, index) => {
                const page = pdfDoc.addPage(copiedPage);
                if (index === 0) {
                    page.drawRectangle({
                        x: 0,
                        y: page.getHeight() - 26,
                        width: page.getWidth(),
                        height: 26,
                        color: rgb(1, 1, 1),
                        opacity: 0.85,
                    });
                    page.drawText(title, {
                        x: margin,
                        y: page.getHeight() - 17,
                        size: 10,
                        color: rgb(0.22, 0.22, 0.22),
                    });
                }
            });
            return;
        }

        if (assetKind === 'png' || assetKind === 'jpg') {
            const page = pdfDoc.addPage([pageWidth, pageHeight]);
            const image = assetKind === 'png'
                ? await pdfDoc.embedPng(buffer)
                : await pdfDoc.embedJpg(buffer);

            const imageDims = image.scale(1);
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = pageHeight - margin * 2 - 24;
            const scale = Math.min(maxWidth / imageDims.width, maxHeight / imageDims.height, 1);
            const width = imageDims.width * scale;
            const height = imageDims.height * scale;

            page.drawText(title, {
                x: margin,
                y: pageHeight - margin,
                size: 12,
                color: rgb(0.15, 0.15, 0.15),
            });

            page.drawImage(image, {
                x: (pageWidth - width) / 2,
                y: Math.max(margin, (pageHeight - height) / 2 - 12),
                width,
                height,
            });
            return;
        }

        this.addFallbackDocumentPage(pdfDoc, title, documentUrl);
    }

    @Get()
    @ApiOperation({ summary: 'Get all applications with filters and pagination' })
    @ApiResponse({ status: 200, description: 'Applications retrieved successfully' })
    async getApplications(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('status') status?: string,
        @Query('programId') programId?: string,
        @Query('search') search?: string,
        @Query('sortBy') sortBy: string = 'createdAt',
        @Query('sortOrder') sortOrder: string = 'desc'
    ) {
        try {
            this.logger.log('Getting applications with filters:', {
                page,
                limit,
                status,
                programId,
                search,
                sortBy,
                sortOrder
            });

            // Build filter object
            const filter: any = { isActive: true };

            if (status && status !== 'all') {
                filter.status = status;
            }

            if (programId && programId !== 'all') {
                filter.programId = new Types.ObjectId(programId);
            }

            // Calculate pagination
            const skip = (page - 1) * limit;
            const normalizedSortOrder = sortOrder === 'asc' ? 1 : -1;

            // Build aggregation pipeline
            // All program info flows through programId → programs → programtypes/programmodes
            const pipeline = [
                { $match: filter },

                // 1. Resolve user info
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },

                // 2. Resolve the program document (single source of truth)
                {
                    $lookup: {
                        from: 'programs',
                        localField: 'programId',
                        foreignField: '_id',
                        as: 'program'
                    }
                },
                { $unwind: '$program' },

                // 3. Resolve programType through program.programTypeId
                {
                    $lookup: {
                        from: 'programtypes',
                        localField: 'program.programTypeId',
                        foreignField: '_id',
                        as: 'programType'
                    }
                },
                { $unwind: { path: '$programType', preserveNullAndEmptyArrays: true } },

                // 4. Resolve programMode through program.programModeId
                {
                    $lookup: {
                        from: 'programmodes',
                        localField: 'program.programModeId',
                        foreignField: '_id',
                        as: 'programMode'
                    }
                },
                { $unwind: { path: '$programMode', preserveNullAndEmptyArrays: true } },

                // 5. Compute display fields
                {
                    $addFields: {
                        applicantName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
                        email: '$user.email',
                        phone: '$user.phone',
                        programName: '$program.name',
                        programTypeLabel: '$programType.type',
                        programModeLabel: '$programMode.description',
                        hasJambScore: { $cond: [{ $ne: ['$jambScore', null] }, 1, 0] }
                    }
                }
            ];

            // Add search filter if provided
            if (search) {
                pipeline.push({
                    $match: {
                        $or: [
                            { applicantName: { $regex: search, $options: 'i' } },
                            { email: { $regex: search, $options: 'i' } },
                            { applicationNumber: { $regex: search, $options: 'i' } }
                        ]
                    }
                } as any);
            }

            // Get total count
            const totalCountPipeline = [...pipeline, { $count: 'total' }];
            const totalResult = await this.applicationModel.aggregate(totalCountPipeline);
            const total = totalResult.length > 0 ? totalResult[0].total : 0;

            // Add sorting and pagination
            const sortStage = sortBy === 'jambScore'
                ? {
                    $sort: {
                        hasJambScore: -1,
                        jambScore: normalizedSortOrder,
                        createdAt: -1,
                    }
                }
                : {
                    $sort: {
                        [sortBy]: normalizedSortOrder,
                    }
                };

            pipeline.push(
                sortStage as any,
                { $skip: skip } as any,
                { $limit: parseInt(limit.toString()) } as any
            );

            // Project final fields
            pipeline.push({
                $project: {
                    _id: 1,
                    applicationNumber: 1,
                    applicantName: 1,
                    email: 1,
                    phone: 1,
                    programName: 1,
                    programTypeLabel: 1,
                    programModeLabel: 1,
                    status: 1,
                    admissionDecision: 1,
                    currentStage: 1,
                    isJambExempt: 1,
                    jambRegistrationNumber: 1,
                    jambScore: 1,
                    entranceExam: 1,
                    screening: 1,
                    entryAcademicSession: 1,
                    matriculationNumber: 1,
                    profileImageUrl: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            } as any);

            const applications = await this.applicationModel.aggregate(pipeline);

            const enrichedApplications = await Promise.all(
                applications.map(async application => {
                    const { currentStage, admissionFlow } = await this.getApplicationAdmissionFlow(application);
                    const programDisplay = [
                        application?.programTypeLabel,
                        application?.programModeLabel,
                        application?.programName,
                    ]
                        .filter(Boolean)
                        .join(' ') || 'N/A';

                    return {
                        ...application,
                        programDisplay,
                        currentStage,
                        admissionFlow,
                    };
                }),
            );

            const totalPages = Math.ceil(total / limit);

            this.logger.log('Applications retrieved successfully:', {
                total,
                page,
                totalPages,
                applicationsCount: applications.length
            });

            return {
                success: true,
                data: {
                    applications: enrichedApplications,
                    pagination: {
                        currentPage: parseInt(page.toString()),
                        totalPages,
                        totalItems: total,
                        itemsPerPage: parseInt(limit.toString())
                    }
                }
            };

        } catch (error) {
            this.logger.error('Error getting applications:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve applications',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get application details by ID' })
    @ApiResponse({ status: 200, description: 'Application details retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Application not found' })
    async getApplicationById(@Param('id') id: string) {
        try {
            this.logger.log('Getting application details for ID:', id);

            if (!Types.ObjectId.isValid(id)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application ID format'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const application = await this.applicationModel
                .findById(id)
                .populate('userId', 'firstName lastName otherName email phone role')
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .populate('programTypeId', 'name type description')
                .populate('programModeId', 'name mode description')
                .populate('entryAcademicSession', 'sessionYear')
                .exec();

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            const { currentStage, admissionFlow } = await this.getApplicationAdmissionFlow(application);
            const userId = this.extractEntityId(application.userId);
            const applicationId = this.extractEntityId(application._id);
            const academicSessionId = this.extractEntityId(application.entryAcademicSession);
            const paymentHistory = userId
                ? await this.paymentsService.getLinkedPaymentsForStaffReview(userId, {
                    applicationId,
                    academicSessionId,
                })
                : {
                    payments: [],
                    totalCount: 0,
                    totalPaid: 0,
                    successfulCount: 0,
                    pendingCount: 0,
                    failedCount: 0,
                    cancelledCount: 0,
                };

            this.logger.log('Application details retrieved successfully:', application._id);

            return {
                success: true,
                data: {
                    application: {
                        ...application.toObject(),
                        programDisplay: this.formatProgramDisplay(application),
                        currentStage,
                        admissionFlow,
                    },
                    paymentHistory,
                }
            };

        } catch (error) {
            this.logger.error('Error getting application details:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve application details',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(':id/export-details-pdf')
    @ApiOperation({ summary: 'Export full application details as PDF with embedded documents' })
    @ApiResponse({ status: 200, description: 'Application details PDF generated successfully' })
    async exportApplicationDetailsPdf(
        @Param('id') id: string,
        @Res() res: Response,
    ) {
        try {
            if (!Types.ObjectId.isValid(id)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application ID format',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            const application = await this.applicationModel
                .findById(id)
                .populate('userId', 'firstName lastName email phone')
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .populate('entryAcademicSession', 'sessionYear')
                .exec();

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found',
                    },
                    HttpStatus.NOT_FOUND,
                );
            }

            const appObj: any = application.toObject();
            appObj.programDisplay = this.formatProgramDisplay(appObj);
            const pageWidth = 595.28;
            const pageHeight = 841.89;
            const margin = 40;
            const lineGap = 15;

            const pdfDoc = await PDFDocument.create();
            const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            let page = pdfDoc.addPage([pageWidth, pageHeight]);
            let y = pageHeight - margin;

            const writeWrappedLine = (text: string, options: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
                const size = options.size ?? 11;
                const font = options.bold ? fontBold : fontRegular;
                const colorTuple = options.color ?? [0.1, 0.1, 0.1];
                const color = rgb(colorTuple[0], colorTuple[1], colorTuple[2]);
                const maxWidth = pageWidth - margin * 2;
                const words = String(text || '').split(/\s+/);
                let currentLine = '';

                words.forEach((word) => {
                    const trial = currentLine ? `${currentLine} ${word}` : word;
                    const trialWidth = font.widthOfTextAtSize(trial, size);

                    if (trialWidth > maxWidth && currentLine) {
                        if (y < margin + lineGap) {
                            page = pdfDoc.addPage([pageWidth, pageHeight]);
                            y = pageHeight - margin;
                        }
                        page.drawText(currentLine, { x: margin, y, size, font, color });
                        y -= lineGap;
                        currentLine = word;
                    } else {
                        currentLine = trial;
                    }
                });

                if (currentLine) {
                    if (y < margin + lineGap) {
                        page = pdfDoc.addPage([pageWidth, pageHeight]);
                        y = pageHeight - margin;
                    }
                    page.drawText(currentLine, { x: margin, y, size, font, color });
                    y -= lineGap;
                }
            };

            const writeSectionTitle = (title: string) => {
                if (y < margin + 38) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    y = pageHeight - margin;
                }
                y -= 5;
                page.drawText(title, {
                    x: margin,
                    y,
                    size: 13,
                    font: fontBold,
                    color: rgb(0.05, 0.3, 0.3),
                });
                y -= lineGap;
            };

            const writeField = (label: string, value: string) => {
                writeWrappedLine(`${label}: ${value || 'N/A'}`);
            };

            writeWrappedLine('Alebiosu College of Nursing Sciences', {
                size: 16,
                bold: true,
                color: [0.05, 0.25, 0.25],
            });
            writeWrappedLine('Applicant Full Details Export', { size: 13, bold: true });
            writeWrappedLine(
                `Generated: ${new Date().toLocaleString()} | Application Number: ${appObj.applicationNumber || 'N/A'}`,
                { size: 10, color: [0.35, 0.35, 0.35] },
            );

            y -= 6;
            if (appObj?.profileImageUrl) {
                try {
                    const { buffer, contentType } = await this.fetchRemoteAsset(appObj.profileImageUrl);
                    const kind = this.getAssetKind(appObj.profileImageUrl, contentType);

                    if (kind === 'png' || kind === 'jpg') {
                        const image = kind === 'png'
                            ? await pdfDoc.embedPng(buffer)
                            : await pdfDoc.embedJpg(buffer);
                        const squareSize = 96;
                        const titleGap = 14;
                        const blockHeight = squareSize + titleGap + 10;

                        if (y < margin + blockHeight + 24) {
                            page = pdfDoc.addPage([pageWidth, pageHeight]);
                            y = pageHeight - margin;
                        }

                        const blockX = margin;
                        const blockY = y - squareSize - titleGap;
                        const dims = image.scale(1);
                        const fitScale = Math.min(squareSize / dims.width, squareSize / dims.height, 1);
                        const width = dims.width * fitScale;
                        const height = dims.height * fitScale;

                        page.drawText('Profile Photograph', {
                            x: blockX,
                            y,
                            size: 11,
                            font: fontBold,
                            color: rgb(0.1, 0.1, 0.1),
                        });

                        page.drawRectangle({
                            x: blockX,
                            y: blockY,
                            width: squareSize,
                            height: squareSize,
                            borderColor: rgb(0.82, 0.84, 0.86),
                            borderWidth: 1,
                            color: rgb(0.99, 0.99, 0.99),
                        });

                        page.drawImage(image, {
                            x: blockX + (squareSize - width) / 2,
                            y: blockY + (squareSize - height) / 2,
                            width,
                            height,
                        });

                        y = blockY - 18;
                    }
                } catch (error) {
                    this.logger.warn('Failed to embed profile image in export PDF', {
                        url: appObj.profileImageUrl,
                        error: error.message,
                    });
                }
            }

            writeSectionTitle('Personal Information');
            writeField('Full Name', this.formatApplicantName(appObj));
            writeField('Email', appObj?.userId?.email || 'N/A');
            writeField('Phone', appObj?.userId?.phone || 'N/A');
            writeField('Date of Birth', appObj?.dob ? new Date(appObj.dob).toLocaleDateString() : 'N/A');
            writeField('Gender', appObj?.gender || 'N/A');
            writeField('Marital Status', appObj?.maritalStatus || 'N/A');

            writeSectionTitle('Contact Information');
            writeField('Address', appObj?.address || 'N/A');
            writeField('State', appObj?.stateOfOrigin || 'N/A');
            writeField('LGA', appObj?.lga || 'N/A');
            writeField('Emergency Contact Name', appObj?.nextOfKin?.name || 'N/A');
            writeField('Emergency Contact Phone', appObj?.nextOfKin?.phone || 'N/A');
            writeField('Emergency Contact Relationship', appObj?.nextOfKin?.relationship || 'N/A');

            writeSectionTitle('Application Information');
            writeField('Program', appObj?.programDisplay || this.formatProgramDisplay(appObj));
            // writeField('Current Stage', appObj?.currentStage ? `Stage ${appObj.currentStage} - ${this.getApplicationStageName(appObj.currentStage)}` : 'N/A');
            // writeField('Status', appObj?.status || 'N/A');
            writeField('Academic Session', this.formatAcademicSession(appObj?.entryAcademicSession));
            writeField('JAMB Registration Number', appObj?.isJambExempt ? 'Not applicable' : (appObj?.jambRegistrationNumber || 'N/A'));
            writeField('JAMB Score', appObj?.isJambExempt ? 'Not applicable' : (appObj?.jambScore?.toString() || 'N/A'));
            writeField('Submitted Date', appObj?.createdAt ? new Date(appObj.createdAt).toLocaleString() : 'N/A');
            writeField('Last Updated', appObj?.updatedAt ? new Date(appObj.updatedAt).toLocaleString() : 'N/A');

            writeSectionTitle('Examination Records');
            if (Array.isArray(appObj?.examinations) && appObj.examinations.length > 0) {
                appObj.examinations.forEach((exam: any, index: number) => {
                    const sittingNumber = index + 1;
                    const sittingLabel = sittingNumber <= 2
                        ? `Sitting ${sittingNumber}`
                        : `Additional Sitting ${sittingNumber}`;

                    writeWrappedLine(sittingLabel, {
                        size: 11,
                        bold: true,
                        color: [0.12, 0.12, 0.12],
                    });
                    writeField('Exam Type', exam?.examType || 'N/A');
                    writeField('Exam Year', exam?.examYear || 'N/A');
                    writeField('Exam Number', exam?.examNumber || 'N/A');

                    if (Array.isArray(exam?.subjects) && exam.subjects.length > 0) {
                        writeWrappedLine('Subjects and Grades:', {
                            size: 10,
                            bold: true,
                            color: [0.25, 0.25, 0.25],
                        });

                        exam.subjects.forEach((subject: any) => {
                            writeWrappedLine(
                                `- ${subject?.subject || 'N/A'}: ${subject?.grade || 'N/A'}`,
                                {
                                    size: 10,
                                    color: [0.15, 0.15, 0.15],
                                },
                            );
                        });
                    } else {
                        writeField('Subjects', 'No subject breakdown submitted');
                    }

                    y -= 4;
                });
            } else {
                writeField('Examinations', 'No examination records submitted');
            }

            writeSectionTitle('Exam and Screening');
            if (appObj?.entranceExam) {
                // writeField('Entrance Exam Date', appObj.entranceExam.date ? new Date(appObj.entranceExam.date).toLocaleDateString() : 'N/A');
                // writeField('Entrance Exam Time', appObj.entranceExam.time || 'N/A');
                // writeField('Entrance Exam Link', appObj.entranceExam.link || 'N/A');
                writeField(
                    'Entrance Exam Score',
                    appObj.entranceExam.score !== undefined ? `${appObj.entranceExam.score}%` : 'Not Available',
                );
            } else {
                writeField('Entrance Exam', 'Not scheduled');
            }

            if (appObj?.screening) {
                // writeField('Screening Date', appObj.screening.date ? new Date(appObj.screening.date).toLocaleDateString() : 'N/A');
                // writeField('Screening Time', appObj.screening.time || 'N/A');
                // writeField('Screening Venue', appObj.screening.venue || 'N/A');
                writeField('Screening Status', appObj.screening.completed ? 'Completed' : 'Pending');
            } else {
                writeField('Screening', 'Not scheduled');
            }

            const supportingDocuments: Array<{ title: string; url: string }> = [];
            (appObj?.documents?.olevelResults || []).forEach((result: unknown, index: number) => {
                const url = this.getDocumentUrl(result);
                if (url) {
                    supportingDocuments.push({ title: `O'Level Result ${index + 1}`, url });
                }
            });

            (appObj?.documents?.referenceLetters || []).forEach((letter: unknown, index: number) => {
                const url = this.getDocumentUrl(letter);
                if (url) {
                    supportingDocuments.push({ title: `Reference Letter ${index + 1}`, url });
                }
            });

            for (const documentItem of supportingDocuments) {
                try {
                    await this.appendSupportingDocument(pdfDoc, documentItem.url, documentItem.title);
                } catch (error) {
                    this.logger.warn('Failed to append supporting document to export PDF', {
                        title: documentItem.title,
                        url: documentItem.url,
                        error: error.message,
                    });
                    this.addFallbackDocumentPage(pdfDoc, documentItem.title, documentItem.url);
                }
            }

            const pdfBuffer = Buffer.from(await pdfDoc.save());
            const fileName = this.buildExportFilename(appObj);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', pdfBuffer.length.toString());
            return res.send(pdfBuffer);
        } catch (error) {
            this.logger.error('Error exporting application details PDF:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to export application details PDF',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Patch(':id/status')
    @ApiOperation({ summary: 'Update application status' })
    @ApiResponse({ status: 200, description: 'Application status updated successfully' })
    @ApiResponse({ status: 404, description: 'Application not found' })
    async updateApplicationStatus(
        @Param('id') id: string,
        @Body() updateData: {
            status: ApplicationStatus;
            remarks?: string;
        }
    ) {
        try {
            this.logger.log('Updating application status:', {
                applicationId: id,
                newStatus: updateData.status,
                hasRemarks: !!updateData.remarks
            });

            if (!Types.ObjectId.isValid(id)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application ID format'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            // Validate status
            if (!Object.values(ApplicationStatus).includes(updateData.status)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Invalid application status'
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Application not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            // Update application status
            application.status = updateData.status;
            await application.save();

            this.logger.log('Application status updated successfully:', {
                applicationId: id,
                oldStatus: application.status,
                newStatus: updateData.status
            });

            return {
                success: true,
                data: {
                    applicationId: id,
                    status: updateData.status,
                    message: 'Application status updated successfully'
                }
            };

        } catch (error) {
            this.logger.error('Error updating application status:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update application status',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('stats/summary')
    @ApiOperation({ summary: 'Get applications statistics summary' })
    @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
    async getApplicationsStats() {
        try {
            this.logger.log('Getting applications statistics');

            const stats = await this.applicationModel.aggregate([
                {
                    $match: { isActive: true }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const totalApplications = await this.applicationModel.countDocuments({ isActive: true });
            const pendingApplications = await this.applicationModel.countDocuments({
                isActive: true,
                status: ApplicationStatus.PENDING,
            });
            const admittedStudents = await this.applicationModel.countDocuments({
                isActive: true,
                $or: [
                    { admissionDecision: AdmissionDecision.GRANTED },
                    { status: ApplicationStatus.ADMITTED },
                    {
                        status: ApplicationStatus.COMPLETED,
                        admissionDecision: AdmissionDecision.GRANTED,
                    },
                ],
            });

            const statsObject = stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            this.logger.log('Applications statistics retrieved successfully:', statsObject);

            return {
                success: true,
                data: {
                    total: totalApplications,
                    pending: pendingApplications,
                    admitted: admittedStudents,
                    byStatus: statsObject
                }
            };

        } catch (error) {
            this.logger.error('Error getting applications statistics:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve applications statistics',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/schedule-exam')
    @ApiOperation({ summary: 'Schedule entrance exam for an application' })
    @ApiResponse({ status: 200, description: 'Exam scheduled successfully' })
    async scheduleExam(
        @Param('id') id: string,
        @Body() examData: {
            examDate: string;
            examTime: string;
            examLink: string;
        }
    ) {
        try {
            this.logger.log('Scheduling exam for application:', { id, examData });

            const application = await this.applicationModel.findById(id)
                .populate('userId', 'firstName lastName email')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
            );

            if (!admissionFlow.entranceExamEnabled) {
                throw new HttpException(
                    { success: false, message: 'Entrance exam is disabled for this academic session' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Update application with exam details using grouped structure
            application.entranceExam = {
                date: new Date(examData.examDate),
                time: examData.examTime,
                link: examData.examLink
            };
            application.currentStage = 4; // Move to exam stage

            await application.save();

            // Send exam scheduled email
            await this.emailService.sendEntranceExamScheduledEmail(
                (application.userId as any).email,
                (application.userId as any).firstName,
                application.entranceExam.date,
                application.entranceExam.time,
                application.entranceExam.link
            );

            this.logger.log('Exam scheduled successfully for application:', id);

            return {
                success: true,
                message: 'Entrance exam scheduled successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error scheduling exam:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to schedule exam',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/schedule-screening')
    @ApiOperation({ summary: 'Schedule screening & interview for an application' })
    @ApiResponse({ status: 200, description: 'Screening scheduled successfully' })
    async scheduleScreening(
        @Param('id') id: string,
        @Body() screeningData: {
            screeningDate: string;
            screeningTime: string;
            venue: string;
        }
    ) {
        try {
            this.logger.log('Scheduling screening for application:', { id, screeningData });

            const application = await this.applicationModel.findById(id)
                .populate('userId', 'firstName lastName email')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
            );

            if (!admissionFlow.screeningEnabled) {
                throw new HttpException(
                    { success: false, message: 'Screening is disabled for this academic session' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (application.admissionDecision !== AdmissionDecision.GRANTED) {
                throw new HttpException(
                    { success: false, message: 'Admission must be granted before screening can be scheduled' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Update application with screening details using grouped structure
            application.screening = {
                date: new Date(screeningData.screeningDate),
                time: screeningData.screeningTime,
                venue: screeningData.venue,
                completed: false
            };
            application.currentStage = 6; // Move to screening stage

            await application.save();

            // Send screening scheduled email
            await this.emailService.sendScreeningScheduledEmail(
                (application.userId as any).email,
                (application.userId as any).firstName,
                application.screening.date,
                application.screening.time,
                application.screening.venue
            );

            this.logger.log('Screening scheduled successfully for application:', id);

            return {
                success: true,
                message: 'Screening & interview scheduled successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error scheduling screening:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to schedule screening',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/admission-decision')
    @ApiOperation({ summary: 'Make admission decision for an application' })
    @ApiResponse({ status: 200, description: 'Admission decision made successfully' })
    async makeAdmissionDecision(
        @Param('id') id: string,
        @Body() decisionData: {
            decision: 'admitted' | 'rejected';
            sendProvisionalOffer?: boolean;
            reason?: string;
        }
    ) {
        try {
            this.logger.log('Making admission decision for application:', { id, decisionData });

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .populate('programId')
                .populate('programTypeId')
                .populate('entryAcademicSession')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
            );

            // Update application with admission decision using correct enum
            const decisionMapping = {
                'admitted': AdmissionDecision.GRANTED,
                'rejected': AdmissionDecision.DENIED
            };

            application.admissionDecision = decisionMapping[decisionData.decision];
            if (decisionData.reason) {
                application.rejectionReason = decisionData.reason;
            }
            if (decisionData.decision !== 'rejected') {
                application.rejectionReason = undefined;
            }

            if (decisionData.decision === 'admitted') {
                application.status = admissionFlow.screeningEnabled
                    ? ApplicationStatus.PENDING
                    : ApplicationStatus.ADMITTED;
                application.currentStage = admissionFlow.screeningEnabled ? 6 : 7;
                application.admissionDate = new Date();
                const shouldSendProvisionalOffer = decisionData.sendProvisionalOffer === true;

                const user = application.userId as any;
                const program = application.programId as any;
                const programType = application.programTypeId as any;
                const academicSession = application.entryAcademicSession as any;

                // Validate required data
                if (!user || !program || !programType || !academicSession) {
                    this.logger.error('Missing required data for admission letter:', {
                        hasUser: !!user,
                        hasProgram: !!program,
                        hasProgramType: !!programType,
                        hasAcademicSession: !!academicSession
                    });
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Missing required data for admission letter generation. Please ensure application has all required information.'
                        },
                        HttpStatus.BAD_REQUEST
                    );
                }

                // Extract values safely, handling both populated objects and raw IDs
                // Academic Session uses 'sessionYear' field
                const academicSessionName = academicSession?.sessionYear || academicSession?.name || '';
                // Program Type uses 'type' field (e.g., "ND", "HND")
                const programTypeCode = programType?.type || programType?.code || programType?.name || '';
                const programName = program?.name || '';

                this.logger.log('Preparing admission decision email for:', {
                    student: user.firstName,
                    program: programName,
                    programType: programTypeCode,
                    session: academicSessionName,
                    sendProvisionalOffer: shouldSendProvisionalOffer,
                    rawSessionData: JSON.stringify(academicSession),
                    programTypeObject: JSON.stringify(programType),
                    programObject: JSON.stringify(program)
                });

                // Validate extracted values
                if (!programTypeCode || !academicSessionName || !programName) {
                    this.logger.error('Failed to extract required data from populated objects:', {
                        hasProgramTypeCode: !!programTypeCode,
                        hasAcademicSessionName: !!academicSessionName,
                        hasProgramName: !!programName
                    });
                    throw new HttpException(
                        {
                            success: false,
                            message: 'Failed to extract required data. Please check if application data is properly populated.'
                        },
                        HttpStatus.BAD_REQUEST
                    );
                }

                if (shouldSendProvisionalOffer) {
                    let acceptanceFeeInWords = '';
                    let acceptanceFeeAmount = '';

                    try {
                        const acceptanceFeePayment = await this.paymentModel.findOne({
                            paymentCode: 'acceptanceFee',
                            active: true
                        });

                        if (acceptanceFeePayment) {
                            acceptanceFeeAmount = acceptanceFeePayment.amount.toLocaleString('en-NG', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            });
                            acceptanceFeeInWords = this.numberToWords(acceptanceFeePayment.amount);

                            this.logger.log('Acceptance fee fetched from database:', {
                                amount: acceptanceFeePayment.amount,
                                formatted: acceptanceFeeAmount,
                                inWords: acceptanceFeeInWords
                            });
                        } else {
                            this.logger.warn('Acceptance fee not found in database, using default values');
                        }
                    } catch (feeError) {
                        this.logger.error('Error fetching acceptance fee:', feeError.message);
                    }

                    const folderIdentifier = application.applicationNumber || application._id.toString();

                    const pdfBuffer = await this.admissionLetterPdfService.generateAdmissionLetter({
                        studentFirstName: user.firstName || '',
                        studentFullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                        programName: programName,
                        programType: programTypeCode,
                        academicSession: academicSessionName,
                        acceptanceFee: acceptanceFeeInWords,
                        acceptanceFeeAmount: acceptanceFeeAmount,
                        admissionDate: new Date()
                    });

                    this.logger.log('Provisional offer PDF generated successfully');

                    const timestamp = Date.now();
                    const pdfFileName = `provisional_offer_${timestamp}.pdf`;

                    try {
                        const mockFile = {
                            buffer: pdfBuffer,
                            originalname: pdfFileName,
                            mimetype: 'application/pdf',
                            size: pdfBuffer.length
                        } as Express.Multer.File;

                        const uploadResult = await this.uploadService.uploadToSpaces(
                            mockFile,
                            folderIdentifier,
                            'admission_letter',
                            false
                        );

                        this.logger.log('Provisional offer PDF uploaded to Spaces:', {
                            url: uploadResult.url,
                            key: uploadResult.key,
                            folder: folderIdentifier
                        });

                        application.admissionLetter = uploadResult.url;

                    } catch (uploadError) {
                        this.logger.error('Failed to upload provisional offer PDF to Spaces:', uploadError.message);
                    }

                    await this.emailService.sendAdmissionLetterEmail(
                        user.email,
                        user.firstName,
                        pdfBuffer,
                        programName,
                        academicSessionName
                    );

                    this.logger.log('Admission email with provisional offer sent successfully');
                } else {
                    application.admissionLetter = undefined;

                    await this.emailService.sendAdmissionOfferEmail(
                        user.email,
                        user.firstName,
                        programName,
                        academicSessionName
                    );

                    this.logger.log('Admission email sent successfully without provisional offer');
                }
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.currentStage = 5; // Stay at admission decision stage but mark as rejected

                // Send rejection email
                await this.emailService.sendRejectionEmail(
                    (application.userId as any).email,
                    (application.userId as any).firstName,
                    decisionData.reason
                );

                this.logger.log('Rejection email sent successfully');
            }

            await application.save();

            this.logger.log('Admission decision made successfully for application:', id);

            return {
                success: true,
                message: `Application ${decisionData.decision} successfully`,
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error making admission decision:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to make admission decision',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/exam-score')
    @ApiOperation({ summary: 'Update entrance exam score' })
    @ApiResponse({ status: 200, description: 'Exam score updated successfully' })
    async updateExamScore(
        @Param('id') id: string,
        @Body() scoreData: {
            score: number;
            passed: boolean;
        }
    ) {
        try {
            this.logger.log('Updating exam score for application:', { id, scoreData });

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
            );

            if (!admissionFlow.entranceExamEnabled) {
                throw new HttpException(
                    { success: false, message: 'Entrance exam is disabled for this academic session' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Update exam score using grouped structure
            if (!application.entranceExam) {
                throw new HttpException(
                    { success: false, message: 'Entrance exam not scheduled yet' },
                    HttpStatus.BAD_REQUEST
                );
            }

            application.entranceExam.score = scoreData.score;

            if (scoreData.passed) {
                application.currentStage = await this.sessionControlsService.getNextStageAfterExam(
                    application.entryAcademicSession,
                );
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.admissionDecision = AdmissionDecision.DENIED;
                application.rejectionReason = 'Failed entrance examination';
            }

            await application.save();

            this.logger.log('Exam score updated successfully for application:', id);

            return {
                success: true,
                message: 'Exam score updated successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error updating exam score:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update exam score',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/complete-screening')
    @ApiOperation({ summary: 'Mark screening as completed' })
    @ApiResponse({ status: 200, description: 'Screening marked as completed' })
    async completeScreening(@Param('id') id: string) {
        try {
            this.logger.log('Marking screening as completed for application:', id);

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
            );

            if (!admissionFlow.screeningEnabled) {
                throw new HttpException(
                    { success: false, message: 'Screening is disabled for this academic session' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (application.admissionDecision !== AdmissionDecision.GRANTED) {
                throw new HttpException(
                    { success: false, message: 'Admission must be granted before screening can be completed' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Update screening completion status using grouped structure
            if (!application.screening) {
                application.screening = { completed: true };
            } else {
                application.screening.completed = true;
            }
            application.status = ApplicationStatus.ADMITTED;
            application.currentStage = 7; // Move to acceptance fee stage
            await application.save();

            this.logger.log('Screening marked as completed for application:', id);

            return {
                success: true,
                message: 'Screening marked as completed',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error completing screening:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to complete screening',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/generate-matric')
    @ApiOperation({ summary: 'Recover missing matriculation number and complete application setup' })
    @ApiResponse({ status: 200, description: 'Matriculation number recovered successfully' })
    async generateMatriculationNumber(@Param('id') id: string) {
        try {
            this.logger.log('Recovering matriculation number for application:', id);

            const application = await this.applicationModel.findById(id)
                .populate(['userId', 'programId', 'entryAcademicSession'])
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            // Check if application is in the correct stage (school fees paid - stage 10)
            if (application.currentStage !== 10) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Cannot generate matriculation number. Student must complete school fees payment first (currentStage must be 10).',
                        currentStage: application.currentStage
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            // Check if matriculation number already exists
            if (application.matriculationNumber) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Matriculation number already generated for this application.',
                        matriculationNumber: application.matriculationNumber
                    },
                    HttpStatus.BAD_REQUEST
                );
            }

            const user = application.userId as any;
            const userId = typeof application.userId === 'object' && application.userId !== null
                ? (application.userId as any)._id
                : application.userId;
            const applicationId = application._id;

            // Generate matriculation number using the proper service
            // Extract the actual ObjectId from the populated program
            const programId = application.programId._id || application.programId;
            const academicSessionId = typeof application.entryAcademicSession === 'object' && application.entryAcademicSession !== null
                ? (application.entryAcademicSession as any)._id
                : application.entryAcademicSession;
            const matriculationNumber = await this.matriculationService.generateMatriculationNumber(
                programId.toString(),
                academicSessionId.toString(),
            );

            // Update application
            application.matriculationNumber = matriculationNumber;
            application.status = ApplicationStatus.COMPLETED;
            // currentStage should already be 10, no need to set it again
            await application.save();

            // Get academic session for student record
            // Extract the ObjectId from the populated entryAcademicSession
            const studentAcademicSessionId = typeof application.entryAcademicSession === 'object' && application.entryAcademicSession !== null
                ? (application.entryAcademicSession as any)._id
                : application.entryAcademicSession;
            const admissionYear = new Date().getFullYear();

            // Create Student record (migrate from applicant to student)
            const existingStudent = await this.studentModel.findOne({
                $or: [
                    { userId },
                    { applicationId },
                ],
            });

            if (!existingStudent) {
                const newStudent = new this.studentModel({
                    userId,
                    applicationId,
                    matriculationNumber: matriculationNumber,
                    programId: application.programId,
                    programTypeId: application.programTypeId,
                    programModeId: application.programModeId,
                    admissionYear: admissionYear,
                    academicSession: studentAcademicSessionId, // Store ObjectId reference
                    status: 'active',
                    currentLevel: 1,
                    currentSemester: 1,
                    cumulativeGPA: 0.0,
                    isActive: true,
                    profileImageUrl: application.profileImageUrl // Copy profile image from application
                });

                await newStudent.save();
                this.logger.log('Student record created successfully:', newStudent._id);
            } else {
                existingStudent.userId = userId;
                existingStudent.applicationId = applicationId;
                existingStudent.matriculationNumber = matriculationNumber;
                existingStudent.programId = application.programId;
                existingStudent.programTypeId = application.programTypeId;
                existingStudent.programModeId = application.programModeId;
                existingStudent.admissionYear = admissionYear;
                existingStudent.academicSession = studentAcademicSessionId;
                existingStudent.profileImageUrl = application.profileImageUrl;
                existingStudent.status = existingStudent.status || 'active';
                existingStudent.currentLevel = existingStudent.currentLevel || 1;
                existingStudent.currentSemester = existingStudent.currentSemester || 1;
                existingStudent.isActive = existingStudent.isActive !== false;
                await existingStudent.save();
                this.logger.log('Student record already exists:', existingStudent._id);
            }

            // Update User role from APPLICANT to STUDENT
            const userRecord = await this.userModel.findById(userId);
            if (userRecord && userRecord.role === UserRole.APPLICANT) {
                userRecord.role = UserRole.STUDENT;
                await userRecord.save();
                this.logger.log('User role updated from APPLICANT to STUDENT:', userRecord._id);
            } else if (userRecord) {
                this.logger.log('User role already set to:', userRecord.role);
            }

            // Send matriculation email
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';
            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Matriculation number recovered successfully:', matriculationNumber);

            return {
                success: true,
                message: 'Matriculation number recovered and email sent successfully',
                data: {
                    application,
                    matriculationNumber
                }
            };

        } catch (error) {
            this.logger.error('Error recovering matriculation number:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to recover matriculation number',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(':id/send-matric-email')
    @ApiOperation({ summary: 'Send matriculation email to student' })
    @ApiResponse({ status: 200, description: 'Matriculation email sent successfully' })
    async sendMatriculationEmail(@Param('id') id: string) {
        try {
            this.logger.log('Sending matriculation email for application:', id);

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            if (!application.matriculationNumber) {
                throw new HttpException(
                    { success: false, message: 'Matriculation number not generated yet' },
                    HttpStatus.BAD_REQUEST
                );
            }

            const user = application.userId as any;
            const studentPortalUrl = process.env.STUDENT_PORTAL_URL || 'http://localhost:3000/student-portal';

            await this.emailService.sendMatriculationEmail(
                user.email,
                user.firstName,
                application.matriculationNumber,
                studentPortalUrl
            );

            this.logger.log('Matriculation email sent successfully to:', user.email);

            return {
                success: true,
                message: 'Matriculation email sent successfully',
                data: {
                    email: user.email,
                    matriculationNumber: application.matriculationNumber
                }
            };

        } catch (error) {
            this.logger.error('Error sending matriculation email:', error.message);
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to send matriculation email',
                    error: error.message
                },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Helper method to convert numbers to words (Nigerian Naira context)
     * Supports numbers up to millions
     */
    private numberToWords(num: number): string {
        if (num === 0) return 'Zero';

        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

        const convertLessThanThousand = (n: number): string => {
            if (n === 0) return '';

            let result = '';

            if (n >= 100) {
                result += ones[Math.floor(n / 100)] + ' Hundred ';
                n %= 100;
            }

            if (n >= 10 && n < 20) {
                result += teens[n - 10] + ' ';
            } else {
                if (n >= 20) {
                    result += tens[Math.floor(n / 10)] + ' ';
                    n %= 10;
                }
                if (n > 0) {
                    result += ones[n] + ' ';
                }
            }

            return result.trim();
        };

        if (num < 1000) {
            return convertLessThanThousand(num);
        } else if (num < 1000000) {
            const thousands = Math.floor(num / 1000);
            const remainder = num % 1000;
            let result = convertLessThanThousand(thousands) + ' Thousand';
            if (remainder > 0) {
                result += ' ' + convertLessThanThousand(remainder);
            }
            return result.trim();
        } else {
            const millions = Math.floor(num / 1000000);
            const remainder = num % 1000000;
            let result = convertLessThanThousand(millions) + ' Million';
            if (remainder > 0) {
                if (remainder >= 1000) {
                    const thousands = Math.floor(remainder / 1000);
                    result += ' ' + convertLessThanThousand(thousands) + ' Thousand';
                    const finalRemainder = remainder % 1000;
                    if (finalRemainder > 0) {
                        result += ' ' + convertLessThanThousand(finalRemainder);
                    }
                } else {
                    result += ' ' + convertLessThanThousand(remainder);
                }
            }
            return result.trim();
        }
    }
}
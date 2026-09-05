import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Body,
    UploadedFile,
    Param,
    Query,
    UseGuards,
    HttpStatus,
    HttpException,
    Logger,
    Res,
    Request,
    UseInterceptors,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
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
import {
    StudentAcademicSession,
    StudentAcademicSessionDocument,
    StudentAcademicSessionStatus,
} from '../schemas/student-academic-session.schema';
import { StudentPayment, StudentPaymentDocument } from '../schemas/student-payment.schema';
import { ExamAttempt, ExamAttemptDocument } from '../schemas/exam-attempt.schema';
import { ExamResult, ExamResultDocument } from '../schemas/exam-result.schema';
import { ExamPassword, ExamPasswordDocument } from '../schemas/exam-password.schema';
import { EmailService } from '../services/email.service';
import { MatriculationService } from '../services/matriculation.service';
import { AdmissionLetterPdfService } from '../services/admission-letter-pdf.service';
import { UploadService } from '../services/upload.service';
import { SessionControlsService } from '../services/session-controls.service';
import { PaymentsService } from '../payments/payments.service';
import { RolesService } from '../services/roles.service';
import { ExpireApplicationDto } from '../dto/expire-application.dto';
import { RevokeAdmissionDecisionDto } from '../dto/revoke-admission-decision.dto';
import { resolveProgramSelection } from '../utils/program-relation.util';
import {
    canRevokeAdmissionDecision,
    getScheduledLagosDateTime,
    hasSubmittedApplication,
    isUnfinishedApplication,
} from '../utils/application-lifecycle.util';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type StaffUploadedFilePayload = {
    type: string;
    url: string;
    key: string;
    originalName?: string;
    size?: number;
    uploadedAt?: string | Date;
};

type StaffApplicationUpdatePayload = {
    programId: string;
    programTypeId?: string;
    programModeId?: string;
    personalInfo: {
        firstName: string;
        middleName?: string;
        lastName: string;
        phone?: string;
        dob?: string;
        gender?: string;
        religion?: string;
        maritalStatus?: string;
        address?: string;
        lga?: string;
        stateOfOrigin?: string;
        nationality?: string;
    };
    academicInfo: {
        primarySchool?: {
            name?: string;
            startDate?: string;
            endDate?: string;
        };
        secondarySchool?: {
            name?: string;
            startDate?: string;
            endDate?: string;
        };
        examinations?: Array<{
            examType?: string;
            examYear?: string;
            examNumber?: string;
            subjects?: Array<{
                subject?: string;
                grade?: string;
            }>;
        }>;
        nextOfKin?: {
            name?: string;
            phone?: string;
            email?: string;
            relationship?: string;
            address?: string;
        };
        jambRegistrationNumber?: string;
        jambScore?: number | string;
        isJambExempt?: boolean;
    };
    uploadedFiles?: StaffUploadedFilePayload[];
};

type ApplicationAuditPayload = {
    action: string;
    description: string;
    actor?: { _id?: string | Types.ObjectId; role?: string } | null;
    metadata?: Record<string, unknown>;
};

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
        @InjectModel(StudentAcademicSession.name) private studentAcademicSessionModel: Model<StudentAcademicSessionDocument>,
        @InjectModel(StudentPayment.name) private studentPaymentModel: Model<StudentPaymentDocument>,
        @InjectModel(ExamAttempt.name) private examAttemptModel: Model<ExamAttemptDocument>,
        @InjectModel(ExamResult.name) private examResultModel: Model<ExamResultDocument>,
        @InjectModel(ExamPassword.name) private examPasswordModel: Model<ExamPasswordDocument>,
        private emailService: EmailService,
        private matriculationService: MatriculationService,
        private admissionLetterPdfService: AdmissionLetterPdfService,
        private uploadService: UploadService,
        private sessionControlsService: SessionControlsService,
        private paymentsService: PaymentsService,
        private rolesService: RolesService,
    ) { }

    private requestUserId(req: any): string {
        return String(req.user?._id || req.user?.userId || '');
    }

    private async assertModulePermission(
        req: any,
        module: string,
        permission: string,
    ): Promise<void> {
        if (req.user?.role === UserRole.ADMIN) return;

        const access = await this.rolesService.getUserModuleAccess(
            this.requestUserId(req),
            module,
        );
        if (
            !access ||
            (!access.permissions.includes(permission) &&
                !access.permissions.includes('manage'))
        ) {
            throw new ForbiddenException(
                `You do not have permission to ${permission.replace(/_/g, ' ')} ${module}`,
            );
        }
    }

    private async assertAdmissionMutationAllowed(application: ApplicationDocument, req: any) {
        await this.assertModulePermission(req, 'admissions', 'approve');
        await this.sessionControlsService.assertAdmissionProcessingEnabled(
            application.entryAcademicSession,
        );
        if (!isUnfinishedApplication(application as any)) {
            throw new ConflictException(
                'Completed, rejected, expired, or matriculated applications cannot be processed for admission',
            );
        }
    }

    private async assertApplicationHasNotBecomeStudent(application: any): Promise<void> {
        const userId = this.extractEntityId(application.userId);
        const applicationId = this.extractEntityId(application._id);
        const [user, student] = await Promise.all([
            userId
                ? this.userModel.findById(userId).select('role').lean()
                : null,
            this.studentModel.findOne({
                $or: [
                    ...(applicationId ? [{ applicationId: new Types.ObjectId(applicationId) }] : []),
                    ...(userId ? [{ userId: new Types.ObjectId(userId) }] : []),
                ],
            }).select('_id').lean(),
        ]);

        if (user?.role === UserRole.STUDENT || student) {
            throw new ConflictException(
                'This application belongs to a student and can no longer be changed through the applicant workflow',
            );
        }
    }

    private assertApplicationWasSubmitted(application: ApplicationDocument): void {
        if (!hasSubmittedApplication(application as any)) {
            throw new ConflictException(
                'The application form must be submitted before admission processing can continue',
            );
        }
    }

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

    private normalizeString(value?: string | null): string | undefined {
        if (typeof value !== 'string') {
            return undefined;
        }

        const normalizedValue = value.trim();
        return normalizedValue ? normalizedValue : undefined;
    }

    private normalizeUploadedFiles(uploadedFiles?: StaffUploadedFilePayload[]): StaffUploadedFilePayload[] {
        if (!Array.isArray(uploadedFiles)) {
            return [];
        }

        return uploadedFiles.filter((file) => file?.type && file?.url && file?.key);
    }

    private collectApplicationAssetKeys(application: any): string[] {
        const assetKeys = new Set<string>();

        [
            application?.profileImageUrl,
            application?.documents?.profilePicture?.url,
            application?.admissionLetter,
        ]
            .map((url) => this.uploadService.extractKeyFromUrl(url))
            .filter(Boolean)
            .forEach((key) => assetKeys.add(key));

        (application?.documents?.olevelResults || []).forEach((document: any) => {
            const key = this.uploadService.extractKeyFromUrl(document?.url);
            if (key) {
                assetKeys.add(key);
            }
        });

        (application?.documents?.referenceLetters || []).forEach((document: any) => {
            const key = this.uploadService.extractKeyFromUrl(document?.url);
            if (key) {
                assetKeys.add(key);
            }
        });

        return [...assetKeys];
    }

    private async assertPreStudentLifecycle(application: any, user: any) {
        const existingStudent = await this.studentModel.findOne({
            $or: [
                { applicationId: application._id },
                { userId: user._id },
            ],
        }).select('_id');

        const blockers: string[] = [];

        if (application?.status === ApplicationStatus.EXPIRED) {
            blockers.push('application is expired');
        }

        if (application?.status === ApplicationStatus.REJECTED) {
            blockers.push('application is rejected');
        }

        if (application?.status === ApplicationStatus.COMPLETED) {
            blockers.push('application is already completed');
        }

        if (application?.currentStage >= 10) {
            blockers.push('application has already reached stage 10');
        }

        if (application?.matriculationNumber) {
            blockers.push('application already has a matriculation number');
        }

        if (user?.role === UserRole.STUDENT) {
            blockers.push('linked user is already a student');
        }

        if (existingStudent) {
            blockers.push('linked student record already exists');
        }

        if (blockers.length) {
            throw new HttpException(
                {
                    success: false,
                    message: `Application can no longer be modified because ${blockers.join(', ')}.`,
                },
                HttpStatus.CONFLICT,
            );
        }
    }

    private appendAuditEntry(application: any, payload: ApplicationAuditPayload) {
        const actorId = this.extractEntityId(payload.actor?._id);

        application.auditTrail = Array.isArray(application.auditTrail)
            ? application.auditTrail
            : [];

        application.auditTrail.push({
            action: payload.action,
            description: payload.description,
            performedBy: actorId ? new Types.ObjectId(actorId) : undefined,
            actorRole: payload.actor?.role,
            metadata: this.normalizeAuditMetadata(payload.metadata),
            createdAt: new Date(),
        });
    }

    private buildApplicationAuditTrail(application: Record<string, any>) {
        const recordedEntries = Array.isArray(application.auditTrail)
            ? application.auditTrail
            : [];
        const auditTrail = [...recordedEntries];
        const hasCreationEntry = auditTrail.some(
            (entry) => entry?.action === 'application_created',
        );

        if (!hasCreationEntry && application.createdAt) {
            auditTrail.push({
                action: 'application_created',
                description: 'Application record was created.',
                performedBy: application.userId,
                actorRole: UserRole.APPLICANT,
                metadata: {
                    source: 'application_record',
                },
                createdAt: application.createdAt,
            });
        }

        if (
            recordedEntries.length === 0 &&
            application.updatedAt &&
            new Date(application.updatedAt).getTime() >
                new Date(application.createdAt || 0).getTime()
        ) {
            auditTrail.push({
                action: 'legacy_state_snapshot',
                description:
                    'Current state captured from an application created before detailed audit tracking was enabled.',
                actorRole: 'system',
                metadata: {
                    status: application.status,
                    admissionDecision: application.admissionDecision,
                    currentStage: application.currentStage,
                },
                createdAt: application.updatedAt,
            });
        }

        return auditTrail;
    }

    private normalizeAuditMetadata(value: unknown, key?: string): unknown {
        if (value === null || value === undefined) {
            return value;
        }

        if (value instanceof Date || value instanceof Types.ObjectId) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeAuditMetadata(item));
        }

        if (typeof value === 'string' && key && /(^_id$|Id$)/i.test(key) && Types.ObjectId.isValid(value)) {
            return new Types.ObjectId(value);
        }

        if (typeof value === 'object') {
            return Object.entries(value as Record<string, unknown>).reduce((accumulator, [entryKey, entryValue]) => {
                accumulator[entryKey] = this.normalizeAuditMetadata(entryValue, entryKey);
                return accumulator;
            }, {} as Record<string, unknown>);
        }

        return value;
    }

    private async moveProfilePictureIfProvided(
        application: any,
        uploadedFiles: StaffUploadedFilePayload[],
    ): Promise<{ profileDocument?: { type: string; url: string; uploadedAt: Date }; profileImageUrl?: string; oldKeysToDelete: string[] }> {
        const profileUploads = uploadedFiles.filter((file) => file.type === 'profile_picture');
        const unsupportedFile = uploadedFiles.find((file) => file.type !== 'profile_picture');

        if (unsupportedFile) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Only profile picture updates are supported in the application edit form for now.',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        if (!profileUploads.length) {
            return { oldKeysToDelete: [] };
        }

        const latestProfileUpload = profileUploads[profileUploads.length - 1];
        const movedProfilePicture = await this.uploadService.moveFromTempToFinal(
            latestProfileUpload.key,
            application.applicationNumber,
            latestProfileUpload.type,
        );

        const oldKeysToDelete = [
            this.uploadService.extractKeyFromUrl(application?.profileImageUrl),
            this.uploadService.extractKeyFromUrl(application?.documents?.profilePicture?.url),
        ].filter(Boolean);

        return {
            profileDocument: {
                type: latestProfileUpload.type,
                url: movedProfilePicture.url,
                uploadedAt: latestProfileUpload.uploadedAt
                    ? new Date(latestProfileUpload.uploadedAt)
                    : new Date(),
            },
            profileImageUrl: movedProfilePicture.url,
            oldKeysToDelete: [...new Set(oldKeysToDelete)],
        };
    }

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
        @Query('academicSessionId') academicSessionId?: string,
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
                academicSessionId,
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

            if (academicSessionId) {
                if (!Types.ObjectId.isValid(academicSessionId)) {
                    throw new HttpException(
                        { success: false, message: 'Invalid academic session ID format' },
                        HttpStatus.BAD_REQUEST,
                    );
                }
                filter.entryAcademicSession = new Types.ObjectId(academicSessionId);
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
                        userRole: '$user.role',
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
                    userRole: 1,
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
                    submittedAt: 1,
                    admissionRevokedAt: 1,
                    admissionRevocationReason: 1,
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
                .populate('auditTrail.performedBy', 'firstName lastName otherName email role')
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
                        message: 'Application not found'
                    },
                    HttpStatus.NOT_FOUND
                );
            }

            const { currentStage, admissionFlow } = await this.getApplicationAdmissionFlow(application);
            const applicationObject = application.toObject();
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
                        ...applicationObject,
                        auditTrail: this.buildApplicationAuditTrail({
                            ...applicationObject,
                            currentStage,
                        }),
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

    @Put(':id')
    @ApiOperation({ summary: 'Update application details before student promotion' })
    @ApiResponse({ status: 200, description: 'Application updated successfully' })
    async updateApplication(
        @Param('id') id: string,
        @Body() updateData: StaffApplicationUpdatePayload,
        @Request() req,
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
                .populate('userId', 'firstName lastName otherName phone role')
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

            const user = application.userId as any;
            await this.assertPreStudentLifecycle(application, user);

            const uploadedFiles = this.normalizeUploadedFiles(updateData.uploadedFiles);
            const resolvedProgram = await resolveProgramSelection({
                programModel: this.programModel,
                programId: updateData.programId,
                providedProgramTypeId: updateData.programTypeId,
                providedProgramModeId: updateData.programModeId,
                logger: this.logger,
                logContext: {
                    actorId: req.user?._id?.toString(),
                    applicationId: application._id?.toString(),
                },
            });

            const profileUpdate = await this.moveProfilePictureIfProvided(application, uploadedFiles);

            const examinations = (updateData.academicInfo?.examinations || [])
                .filter((exam) => exam?.examType && exam?.examYear && exam?.examNumber)
                .map((exam) => ({
                    examType: exam.examType.trim(),
                    examYear: exam.examYear.trim(),
                    examNumber: exam.examNumber.trim(),
                    subjects: (exam.subjects || [])
                        .filter((subject) => subject?.subject && subject?.grade)
                        .map((subject) => ({
                            subject: subject.subject.trim(),
                            grade: subject.grade.trim(),
                        })),
                }));

            const nextOfKin = updateData.academicInfo?.nextOfKin;
            const hasNextOfKin = !!(
                this.normalizeString(nextOfKin?.name) ||
                this.normalizeString(nextOfKin?.phone) ||
                this.normalizeString(nextOfKin?.email) ||
                this.normalizeString(nextOfKin?.relationship) ||
                this.normalizeString(nextOfKin?.address)
            );

            await this.userModel.findByIdAndUpdate(user._id, {
                firstName: this.normalizeString(updateData.personalInfo?.firstName),
                otherName: this.normalizeString(updateData.personalInfo?.middleName),
                lastName: this.normalizeString(updateData.personalInfo?.lastName),
                phone: this.normalizeString(updateData.personalInfo?.phone),
                dob: updateData.personalInfo?.dob ? new Date(updateData.personalInfo.dob) : undefined,
                gender: this.normalizeString(updateData.personalInfo?.gender),
                ...(profileUpdate.profileImageUrl && {
                    profileImageUrl: profileUpdate.profileImageUrl,
                }),
            });

            application.programId = resolvedProgram.programObjectId;
            application.dob = updateData.personalInfo?.dob ? new Date(updateData.personalInfo.dob) : undefined;
            application.gender = this.normalizeString(updateData.personalInfo?.gender);
            application.religion = this.normalizeString(updateData.personalInfo?.religion);
            application.maritalStatus = this.normalizeString(updateData.personalInfo?.maritalStatus);
            application.address = this.normalizeString(updateData.personalInfo?.address);
            application.stateOfOrigin = this.normalizeString(updateData.personalInfo?.stateOfOrigin);
            application.lga = this.normalizeString(updateData.personalInfo?.lga);
            application.nationality = this.normalizeString(updateData.personalInfo?.nationality);

            application.academicBackground = {
                primary: {
                    name: this.normalizeString(updateData.academicInfo?.primarySchool?.name),
                    startDate: this.normalizeString(updateData.academicInfo?.primarySchool?.startDate),
                    endDate: this.normalizeString(updateData.academicInfo?.primarySchool?.endDate),
                },
                secondary: {
                    name: this.normalizeString(updateData.academicInfo?.secondarySchool?.name),
                    startDate: this.normalizeString(updateData.academicInfo?.secondarySchool?.startDate),
                    endDate: this.normalizeString(updateData.academicInfo?.secondarySchool?.endDate),
                },
            };

            application.nextOfKin = hasNextOfKin
                ? {
                    name: this.normalizeString(nextOfKin?.name),
                    phone: this.normalizeString(nextOfKin?.phone),
                    email: this.normalizeString(nextOfKin?.email),
                    relationship: this.normalizeString(nextOfKin?.relationship),
                    address: this.normalizeString(nextOfKin?.address),
                }
                : undefined;

            application.examinations = examinations;
            application.isJambExempt = updateData.academicInfo?.isJambExempt === true;

            if (application.isJambExempt) {
                application.jambRegistrationNumber = undefined;
                application.jambScore = undefined;
            } else {
                application.jambRegistrationNumber = this.normalizeString(updateData.academicInfo?.jambRegistrationNumber);
                application.jambScore =
                    updateData.academicInfo?.jambScore !== undefined &&
                        updateData.academicInfo?.jambScore !== null &&
                        updateData.academicInfo?.jambScore !== ''
                        ? Number(updateData.academicInfo.jambScore)
                        : undefined;
            }

            if (profileUpdate.profileDocument) {
                application.documents = {
                    ...(application.documents || { olevelResults: [], referenceLetters: [] }),
                    profilePicture: profileUpdate.profileDocument,
                    olevelResults: application.documents?.olevelResults || [],
                    referenceLetters: application.documents?.referenceLetters || [],
                } as any;
                application.profileImageUrl = profileUpdate.profileImageUrl;
            }

            this.appendAuditEntry(application, {
                action: 'application_updated',
                description: 'Application details were updated by staff.',
                actor: req.user,
                metadata: {
                    programId: resolvedProgram.programId,
                    replacedProfilePhoto: !!profileUpdate.profileDocument,
                    examinationsCount: examinations.length,
                    isJambExempt: application.isJambExempt === true,
                },
            });
            await application.save();

            await this.uploadService.deleteManyFromSpaces(profileUpdate.oldKeysToDelete);

            this.logger.log('Application updated successfully:', {
                applicationId: application._id.toString(),
                actorId: req.user?._id?.toString(),
            });

            return {
                success: true,
                message: 'Application updated successfully',
                data: {
                    applicationId: application._id.toString(),
                },
            };
        } catch (error) {
            this.logger.error('Error updating application:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to update application',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post(':id/upload-profile-photo')
    @Patch(':id/upload-profile-photo')
    @UseInterceptors(FileInterceptor('file'))
    @ApiOperation({ summary: 'Upload a temporary replacement profile photo for an application' })
    @ApiResponse({ status: 200, description: 'Profile photo uploaded successfully' })
    async uploadApplicationProfilePhoto(
        @Param('id') id: string,
        @Request() req,
        @Body() body,
        @UploadedFile() file: Express.Multer.File,
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

            if (!file) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Profile photo file is required',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            const application = await this.applicationModel
                .findById(id)
                .populate('userId', 'role')
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

            await this.assertPreStudentLifecycle(application, application.userId as any);

            const uploadResult = await this.uploadService.uploadToSpaces(
                file,
                application.applicationNumber,
                body?.fileType || 'profile_picture',
                true,
            );

            this.logger.log('Temporary staff profile photo uploaded successfully:', {
                applicationId: application._id.toString(),
                actorId: req.user?._id?.toString(),
                key: uploadResult.key,
            });

            return {
                success: true,
                data: {
                    type: 'profile_picture',
                    url: uploadResult.url,
                    key: uploadResult.key,
                    originalName: file.originalname,
                    size: file.size,
                    uploadedAt: new Date(),
                },
            };
        } catch (error) {
            this.logger.error('Error uploading temporary application profile photo:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to upload profile photo',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete an application before student promotion' })
    @ApiResponse({ status: 200, description: 'Application deleted successfully' })
    async deleteApplication(@Param('id') id: string) {
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
                .populate('userId', 'role email')
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

            const user = application.userId as any;
            await this.assertPreStudentLifecycle(application, user);

            const paymentRecords = await this.studentPaymentModel
                .find({
                    $or: [
                        { applicationId: application._id },
                        { userId: user._id },
                    ],
                })
                .select('_id receiptKey receiptUrl');

            const applicationAssetKeys = this.collectApplicationAssetKeys(application);
            const receiptKeys = paymentRecords
                .map((payment) => payment.receiptKey || this.uploadService.extractKeyFromUrl(payment.receiptUrl))
                .filter(Boolean);

            await this.examResultModel.deleteMany({ userId: user._id });
            await this.examAttemptModel.deleteMany({ userId: user._id });
            await this.examPasswordModel.updateMany(
                { usedBy: user._id },
                { $pull: { usedBy: user._id } },
            );
            await this.studentPaymentModel.deleteMany({
                $or: [
                    { applicationId: application._id },
                    { userId: user._id },
                ],
            });
            await this.applicationModel.deleteOne({ _id: application._id });
            await this.userModel.deleteOne({ _id: user._id });

            await this.uploadService.deleteManyFromSpaces([
                ...applicationAssetKeys,
                ...receiptKeys,
            ]);
            await this.uploadService.deleteByPrefix(
                this.uploadService.getApplicationTempPrefix(application.applicationNumber),
            );

            this.logger.log('Application deleted successfully:', {
                applicationId: application._id.toString(),
                userId: user._id.toString(),
            });

            return {
                success: true,
                message: 'Application deleted successfully',
                data: {
                    applicationId: application._id.toString(),
                    userId: user._id.toString(),
                },
            };
        } catch (error) {
            this.logger.error('Error deleting application:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to delete application',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
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
    @ApiOperation({ summary: 'Legacy direct status update endpoint (disabled)' })
    @ApiResponse({ status: 400, description: 'Use a dedicated application workflow action' })
    async updateApplicationStatus(
        @Param('id') _id: string,
        @Body() _updateData: {
            status: ApplicationStatus;
            remarks?: string;
        },
        @Request() req,
    ) {
        await this.assertModulePermission(req, 'applications', 'edit');
        throw new HttpException(
            'Direct status changes are disabled. Use the dedicated admission, expiry, screening, payment, or matriculation action',
            HttpStatus.BAD_REQUEST,
        );
    }

    @Patch(':id/expire')
    @ApiOperation({ summary: 'Expire one eligible application with a reason' })
    @ApiResponse({ status: 200, description: 'Application expired successfully' })
    async expireApplication(
        @Param('id') id: string,
        @Body() payload: ExpireApplicationDto,
        @Request() req,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new HttpException('Invalid application ID format', HttpStatus.BAD_REQUEST);
        }

        await this.assertModulePermission(req, 'applications', 'expire');

        const applicationId = new Types.ObjectId(id);
        const existing = await this.applicationModel
            .findById(applicationId)
            .select('status admissionDecision currentStage matriculationNumber applicationNumber userId entryAcademicSession')
            .lean();

        if (!existing) {
            throw new HttpException('Application not found', HttpStatus.NOT_FOUND);
        }
        if (!isUnfinishedApplication(existing as any)) {
            throw new ConflictException(
                'Completed, rejected, expired, or matriculated applications cannot be expired',
            );
        }
        await this.assertApplicationHasNotBecomeStudent(existing);

        const actorId = new Types.ObjectId(this.requestUserId(req));
        const expiredAt = new Date();
        const auditEntry = {
            action: 'application_expired',
            description: 'Application expired manually by an authorized staff member.',
            performedBy: actorId,
            actorRole: req.user?.role,
            metadata: {
                previousStatus: existing.status,
                nextStatus: ApplicationStatus.EXPIRED,
                previousAdmissionDecision: existing.admissionDecision,
                nextAdmissionDecision: existing.admissionDecision,
                previousStage: existing.currentStage,
                nextStage: existing.currentStage,
                reason: payload.reason,
            },
            createdAt: expiredAt,
        };

        const application = await this.applicationModel
            .findOneAndUpdate(
                {
                    _id: applicationId,
                    status: {
                        $nin: [
                            ApplicationStatus.COMPLETED,
                            ApplicationStatus.REJECTED,
                            ApplicationStatus.EXPIRED,
                        ],
                    },
                    $or: [
                        { matriculationNumber: { $exists: false } },
                        { matriculationNumber: null },
                        { matriculationNumber: '' },
                    ],
                },
                {
                    $set: {
                        status: ApplicationStatus.EXPIRED,
                        expiredAt,
                        expiredBy: actorId,
                        expirationReason: payload.reason,
                    },
                    $push: { auditTrail: auditEntry },
                },
                { new: true },
            )
            .populate('userId', 'email firstName')
            .populate('entryAcademicSession', 'sessionYear title')
            .exec();

        if (!application) {
            throw new ConflictException(
                'The application changed while it was being expired. Refresh and try again',
            );
        }

        const user = application.userId as any;
        const session = application.entryAcademicSession as any;
        if (user?.email) {
            this.emailService.sendApplicationExpiredEmail(
                user.email,
                user.firstName || 'Applicant',
                application.applicationNumber,
                payload.reason,
                session?.title || session?.sessionYear,
            ).catch((error) => this.logger.error(
                `Application ${application.applicationNumber} expired, but its notification email failed`,
                error,
            ));
        }

        return {
            success: true,
            message: 'Application expired successfully',
            data: { application },
        };
    }

    @Patch(':id/revoke-admission')
    @ApiOperation({ summary: 'Revoke an admission decision before student conversion' })
    @ApiResponse({ status: 200, description: 'Admission decision revoked successfully' })
    async revokeAdmissionDecision(
        @Param('id') id: string,
        @Body() payload: RevokeAdmissionDecisionDto,
        @Request() req,
    ) {
        if (!Types.ObjectId.isValid(id)) {
            throw new HttpException('Invalid application ID format', HttpStatus.BAD_REQUEST);
        }

        await this.assertModulePermission(req, 'admissions', 'revoke');

        const applicationId = new Types.ObjectId(id);
        const existing = await this.applicationModel
            .findById(applicationId)
            .select(
                'status admissionDecision currentStage matriculationNumber userId entryAcademicSession admissionDate admissionLetter screening',
            )
            .lean();

        if (!existing) {
            throw new HttpException('Application not found', HttpStatus.NOT_FOUND);
        }

        await this.sessionControlsService.assertAdmissionProcessingEnabled(
            existing.entryAcademicSession,
        );

        if (!canRevokeAdmissionDecision(existing as any)) {
            throw new ConflictException(
                'Only unfinished admitted applications can have their admission decision revoked',
            );
        }
        await this.assertApplicationHasNotBecomeStudent(existing);

        const actorId = new Types.ObjectId(this.requestUserId(req));
        const revokedAt = new Date();
        const auditEntry = {
            action: 'admission_decision_revoked',
            description: 'Admission decision was revoked and returned for review.',
            performedBy: actorId,
            actorRole: req.user?.role,
            metadata: {
                reason: payload.reason,
                previousStatus: existing.status,
                nextStatus: ApplicationStatus.PENDING,
                previousAdmissionDecision: existing.admissionDecision,
                nextAdmissionDecision: AdmissionDecision.AWAITING_DECISION,
                previousStage: existing.currentStage,
                nextStage: 5,
                previousAdmissionDate: existing.admissionDate,
                previousAdmissionLetter: existing.admissionLetter,
                previousScreening: existing.screening,
            },
            createdAt: revokedAt,
        };
        const setValues: Record<string, unknown> = {
            status: ApplicationStatus.PENDING,
            admissionDecision: AdmissionDecision.AWAITING_DECISION,
            currentStage: 5,
            admissionRevokedAt: revokedAt,
            admissionRevokedBy: actorId,
            admissionRevocationReason: payload.reason,
        };
        const application = await this.applicationModel
            .findOneAndUpdate(
                {
                    _id: applicationId,
                    admissionDecision: AdmissionDecision.GRANTED,
                    status: {
                        $nin: [
                            ApplicationStatus.COMPLETED,
                            ApplicationStatus.REJECTED,
                            ApplicationStatus.EXPIRED,
                        ],
                    },
                    $or: [
                        { matriculationNumber: { $exists: false } },
                        { matriculationNumber: null },
                        { matriculationNumber: '' },
                    ],
                },
                {
                    $set: setValues,
                    $unset: {
                        admissionDate: 1,
                        admissionLetter: 1,
                        rejectionReason: 1,
                        screening: 1,
                    },
                    $push: { auditTrail: auditEntry },
                },
                { new: true },
            )
            .populate('userId', 'email firstName role')
            .populate('entryAcademicSession', 'sessionYear title')
            .exec();

        if (!application) {
            throw new ConflictException(
                'The application changed while the admission was being revoked. Refresh and try again',
            );
        }

        const user = application.userId as any;
        const session = application.entryAcademicSession as any;
        if (user?.email) {
            this.emailService.sendAdmissionDecisionRevokedEmail(
                user.email,
                user.firstName || 'Applicant',
                application.applicationNumber,
                payload.reason,
                session?.title || session?.sessionYear,
            ).catch((error) => this.logger.error(
                `Admission for ${application.applicationNumber} was revoked, but its notification email failed`,
                error,
            ));
        }

        return {
            success: true,
            message: 'Admission decision revoked successfully',
            data: { application },
        };
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
        },
        @Request() req,
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

            await this.assertAdmissionMutationAllowed(application, req);
            this.assertApplicationWasSubmitted(application);
            await this.assertApplicationHasNotBecomeStudent(application);

            if (
                application.status !== ApplicationStatus.PENDING ||
                application.admissionDecision !== AdmissionDecision.AWAITING_DECISION
            ) {
                throw new ConflictException(
                    'An entrance examination cannot be scheduled after an admission decision has been recorded',
                );
            }
            if (application.entranceExam) {
                throw new ConflictException(
                    'An entrance examination is already scheduled for this application',
                );
            }
            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
                application,
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
            this.appendAuditEntry(application, {
                action: 'entrance_exam_scheduled',
                description: 'Entrance exam was scheduled for the application.',
                actor: req.user,
                metadata: {
                    examDate: examData.examDate,
                    examTime: examData.examTime,
                    hasExamLink: !!examData.examLink,
                },
            });

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
            if (error instanceof HttpException) throw error;
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
        },
        @Request() req,
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

            await this.assertAdmissionMutationAllowed(application, req);
            await this.assertApplicationHasNotBecomeStudent(application);
            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
                application,
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

            if (application.screening) {
                throw new ConflictException(
                    application.screening.completed
                        ? 'Screening has already been completed for this application'
                        : 'Screening is already scheduled for this application',
                );
            }

            const normalizedVenue = screeningData.venue?.trim();

            if (!screeningData.screeningDate || !screeningData.screeningTime) {
                throw new HttpException(
                    { success: false, message: 'Screening date and time are required' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (!normalizedVenue) {
                throw new HttpException(
                    { success: false, message: 'Screening venue is required' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            const screeningDate = new Date(screeningData.screeningDate);

            if (Number.isNaN(screeningDate.getTime())) {
                throw new HttpException(
                    { success: false, message: 'Screening date is invalid' },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // Update application with screening details using grouped structure
            application.screening = {
                date: screeningDate,
                time: screeningData.screeningTime,
                venue: normalizedVenue,
                completed: false
            };
            application.currentStage = 6; // Move to screening stage
            this.appendAuditEntry(application, {
                action: 'screening_scheduled',
                description: 'Screening was scheduled for the application.',
                actor: req.user,
                metadata: {
                    screeningDate: screeningData.screeningDate,
                    screeningTime: screeningData.screeningTime,
                    venue: screeningData.venue,
                },
            });

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
            const errorMessage = error instanceof Error ? error.message : 'Failed to schedule screening';
            this.logger.error('Error scheduling screening:', errorMessage);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to schedule screening',
                    error: errorMessage
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
        },
        @Request() req,
    ) {
        try {
            this.logger.log('Making admission decision for application:', { id, decisionData });

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .populate('entryAcademicSession')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            await this.assertAdmissionMutationAllowed(application, req);
            this.assertApplicationWasSubmitted(application);
            await this.assertApplicationHasNotBecomeStudent(application);

            if (
                application.status !== ApplicationStatus.PENDING ||
                application.admissionDecision !== AdmissionDecision.AWAITING_DECISION
            ) {
                throw new ConflictException(
                    'An admission decision has already been recorded for this application',
                );
            }
            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
                application,
            );

            if (
                admissionFlow.entranceExamEnabled &&
                (application.entranceExam?.score === undefined || application.entranceExam?.score === null)
            ) {
                throw new ConflictException(
                    'The entrance examination must be scored before an admission decision is recorded',
                );
            }

            const previousStatus = application.status;
            const previousAdmissionDecision = application.admissionDecision;
            const previousStage = application.currentStage;

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
                application.admissionRevokedAt = undefined;
                application.admissionRevokedBy = undefined;
                application.admissionRevocationReason = undefined;
                application.status = admissionFlow.screeningEnabled
                    ? ApplicationStatus.PENDING
                    : ApplicationStatus.ADMITTED;
                application.currentStage = admissionFlow.screeningEnabled ? 6 : 7;
                application.admissionDate = new Date();
                const shouldSendProvisionalOffer = decisionData.sendProvisionalOffer === true;

                const user = application.userId as any;
                const program = application.programId as any;
                const programType = program?.programTypeId as any;
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
                        studentLastName: user.lastName || '',
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

            this.appendAuditEntry(application, {
                action: 'admission_decision_recorded',
                description: `Admission decision recorded as ${decisionData.decision}.`,
                actor: req.user,
                metadata: {
                    decision: decisionData.decision,
                    sendProvisionalOffer: decisionData.sendProvisionalOffer === true,
                    reason: decisionData.reason,
                    previousStatus,
                    nextStatus: application.status,
                    previousAdmissionDecision,
                    nextAdmissionDecision: application.admissionDecision,
                    previousStage,
                    nextStage: application.currentStage,
                },
            });

            await application.save();

            this.logger.log('Admission decision made successfully for application:', id);

            return {
                success: true,
                message: `Application ${decisionData.decision} successfully`,
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error making admission decision:', error.message);
            if (error instanceof HttpException) throw error;
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

    @Patch(':id/send-admission-letter')
    @ApiOperation({ summary: 'Send or resend provisional admission letter for an admitted application' })
    @ApiResponse({ status: 200, description: 'Provisional admission letter processed successfully' })
    async sendAdmissionLetter(
        @Param('id') id: string,
        @Request() req,
    ) {
        try {
            this.logger.log('Sending provisional admission letter for application:', { id });

            const application = await this.applicationModel.findById(id)
                .populate('userId')
                .populate({
                    path: 'programId',
                    select: 'name code programTypeId programModeId',
                    populate: [
                        { path: 'programTypeId', select: 'type description' },
                        { path: 'programModeId', select: 'mode description' },
                    ],
                })
                .populate('entryAcademicSession')
                .exec();

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            await this.assertAdmissionMutationAllowed(application, req);
            await this.assertApplicationHasNotBecomeStudent(application);
            if (application.admissionDecision !== AdmissionDecision.GRANTED) {
                throw new HttpException(
                    { success: false, message: 'Admission letter can only be sent for admitted applications' },
                    HttpStatus.BAD_REQUEST
                );
            }

            const context = this.buildAdmissionLetterContext(application);

            let pdfBuffer: Buffer | null = null;
            let mode: 'resent' | 'generated' = 'resent';

            if (application.admissionLetter) {
                try {
                    pdfBuffer = await this.uploadService.getFileBufferByUrl(application.admissionLetter);
                    if (!pdfBuffer || pdfBuffer.length === 0) {
                        mode = 'generated';
                    }
                } catch (fetchError) {
                    this.logger.warn('Failed to fetch existing admission letter buffer, falling back to regeneration:', {
                        applicationId: id,
                        error: fetchError.message,
                    });
                    mode = 'generated';
                }
            } else {
                mode = 'generated';
            }

            if (mode === 'generated') {
                const { acceptanceFeeInWords, acceptanceFeeAmount } = await this.getAcceptanceFeeDetails();

                pdfBuffer = await this.admissionLetterPdfService.generateAdmissionLetter({
                    studentFirstName: context.user.firstName || '',
                    studentLastName: context.user.lastName || '',
                    studentFullName: `${context.user.firstName || ''} ${context.user.lastName || ''}`.trim(),
                    programName: context.programName,
                    programType: context.programTypeCode,
                    academicSession: context.academicSessionName,
                    acceptanceFee: acceptanceFeeInWords,
                    acceptanceFeeAmount,
                    admissionDate: application.admissionDate || new Date(),
                });

                const folderIdentifier = application.applicationNumber || application._id.toString();
                const timestamp = Date.now();
                const pdfFileName = `provisional_offer_${timestamp}.pdf`;

                const mockFile = {
                    buffer: pdfBuffer,
                    originalname: pdfFileName,
                    mimetype: 'application/pdf',
                    size: pdfBuffer.length,
                } as Express.Multer.File;

                const uploadResult = await this.uploadService.uploadToSpaces(
                    mockFile,
                    folderIdentifier,
                    'admission_letter',
                    false
                );

                application.admissionLetter = uploadResult.url;
            }

            await this.emailService.sendProvisionalAdmissionLetterFocusedEmail(
                context.user.email,
                context.user.firstName,
                pdfBuffer as Buffer,
                context.programName,
                context.academicSessionName
            );

            this.appendAuditEntry(application, {
                action: mode === 'generated' ? 'admission_letter_generated_and_sent' : 'admission_letter_resent',
                description: mode === 'generated'
                    ? 'Provisional admission letter was generated, saved, and sent to the student.'
                    : 'Existing provisional admission letter was resent to the student.',
                actor: req.user,
                metadata: {
                    mode,
                    recipientEmail: context.user.email,
                    admissionLetterUrl: application.admissionLetter,
                },
            });

            await application.save();

            return {
                success: true,
                message: mode === 'generated'
                    ? 'Provisional admission letter generated and sent successfully'
                    : 'Provisional admission letter resent successfully',
                data: {
                    mode,
                    admissionLetterUrl: application.admissionLetter,
                },
            };
        } catch (error) {
            this.logger.error('Error sending provisional admission letter:', error.message);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to send provisional admission letter',
                    error: error.message,
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
        },
        @Request() req,
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

            await this.assertAdmissionMutationAllowed(application, req);
            this.assertApplicationWasSubmitted(application);
            await this.assertApplicationHasNotBecomeStudent(application);
            if (
                application.status !== ApplicationStatus.PENDING ||
                application.admissionDecision !== AdmissionDecision.AWAITING_DECISION
            ) {
                throw new ConflictException(
                    'An entrance examination score cannot be recorded after an admission decision',
                );
            }
            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
                application,
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

            if (
                application.entranceExam.score !== undefined &&
                application.entranceExam.score !== null
            ) {
                throw new ConflictException(
                    'An entrance examination score has already been recorded for this application',
                );
            }

            application.entranceExam.score = scoreData.score;

            if (scoreData.passed) {
                application.currentStage = await this.sessionControlsService.getNextStageAfterExam(
                    application.entryAcademicSession,
                    application,
                );
            } else {
                application.status = ApplicationStatus.REJECTED;
                application.admissionDecision = AdmissionDecision.DENIED;
                application.rejectionReason = 'Failed entrance examination';
            }

            this.appendAuditEntry(application, {
                action: 'entrance_exam_scored',
                description: `Entrance exam score was recorded as ${scoreData.score}.`,
                actor: req.user,
                metadata: {
                    score: scoreData.score,
                    passed: scoreData.passed,
                },
            });

            await application.save();

            this.logger.log('Exam score updated successfully for application:', id);

            return {
                success: true,
                message: 'Exam score updated successfully',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error updating exam score:', error.message);
            if (error instanceof HttpException) throw error;
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
    async completeScreening(@Param('id') id: string, @Request() req) {
        try {
            this.logger.log('Marking screening as completed for application:', id);

            const application = await this.applicationModel.findById(id);

            if (!application) {
                throw new HttpException(
                    { success: false, message: 'Application not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            await this.assertAdmissionMutationAllowed(application, req);
            await this.assertApplicationHasNotBecomeStudent(application);
            const admissionFlow = await this.sessionControlsService.getAdmissionFlowConfig(
                application.entryAcademicSession,
                application,
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

            if (!application.screening) {
                throw new ConflictException(
                    'Screening must be scheduled before it can be completed',
                );
            }

            if (application.screening.completed) {
                throw new ConflictException(
                    'Screening has already been completed for this application',
                );
            }

            const scheduledAt = getScheduledLagosDateTime(
                application.screening.date,
                application.screening.time,
            );
            if (!scheduledAt) {
                throw new ConflictException(
                    'The scheduled screening date or time is invalid',
                );
            }
            if (scheduledAt.getTime() > Date.now()) {
                throw new ConflictException(
                    'Screening cannot be completed before its scheduled date and time',
                );
            }

            const previousStatus = application.status;
            const previousStage = application.currentStage;
            application.screening.completed = true;
            application.status = ApplicationStatus.ADMITTED;
            application.currentStage = 7; // Move to acceptance fee stage
            this.appendAuditEntry(application, {
                action: 'screening_completed',
                description: 'Screening was marked as completed.',
                actor: req.user,
                metadata: {
                    scheduledAt,
                    previousStatus,
                    resultingStatus: application.status,
                    previousStage,
                    resultingStage: application.currentStage,
                },
            });
            await application.save();

            this.logger.log('Screening marked as completed for application:', id);

            return {
                success: true,
                message: 'Screening marked as completed',
                data: { application }
            };

        } catch (error) {
            this.logger.error('Error completing screening:', error.message);
            if (error instanceof HttpException) throw error;
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
    async generateMatriculationNumber(@Param('id') id: string, @Request() req) {
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

            if (application.status === ApplicationStatus.EXPIRED) {
                throw new ConflictException('Expired applications cannot be matriculated');
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

            let studentProfileImageUrl: string | undefined;
            if (application.profileImageUrl) {
                try {
                    const copiedProfileImage = await this.uploadService.copyProfileImageToStudentFolder(
                        application.profileImageUrl,
                        matriculationNumber,
                    );
                    studentProfileImageUrl = copiedProfileImage?.url;
                } catch (error) {
                    this.logger.error('Student profile image migration failed; manual matriculation can be retried:', {
                        applicationId: applicationId.toString(),
                        userId: userId.toString(),
                        matriculationNumber,
                        error: error.message,
                    });
                }
            }

            // Update application
            application.matriculationNumber = matriculationNumber;
            application.status = ApplicationStatus.COMPLETED;
            // currentStage should already be 10, no need to set it again
            this.appendAuditEntry(application, {
                action: 'matriculation_generated',
                description: 'Matriculation number was generated and application was completed.',
                actor: req.user,
                metadata: {
                    matriculationNumber,
                },
            });
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
                    admissionYear: admissionYear,
                    academicSession: studentAcademicSessionId, // Store ObjectId reference
                    entryAcademicSession: studentAcademicSessionId,
                    status: 'active',
                    currentLevel: 1,
                    currentSemester: 1,
                    cumulativeGPA: null,
                    isActive: true,
                    profileImageUrl: studentProfileImageUrl,
                });

                await newStudent.save();
                await this.studentAcademicSessionModel.updateOne(
                    { studentId: newStudent._id, academicSessionId: studentAcademicSessionId },
                    {
                        $setOnInsert: {
                            status: StudentAcademicSessionStatus.CURRENT,
                            startedAt: new Date(),
                        },
                    },
                    { upsert: true },
                );
                this.logger.log('Student record created successfully:', newStudent._id);
            } else {
                existingStudent.userId = userId;
                existingStudent.applicationId = applicationId;
                existingStudent.matriculationNumber = matriculationNumber;
                existingStudent.programId = application.programId;
                existingStudent.admissionYear = admissionYear;
                // Keep the original cohort and any staff-assigned progression session.
                if (!existingStudent.academicSession) {
                    existingStudent.academicSession = studentAcademicSessionId;
                }
                if (!existingStudent.entryAcademicSession) {
                    existingStudent.entryAcademicSession = studentAcademicSessionId;
                }
                if (studentProfileImageUrl) {
                    existingStudent.profileImageUrl = studentProfileImageUrl;
                }
                existingStudent.status = existingStudent.status || 'active';
                existingStudent.currentLevel = existingStudent.currentLevel || 1;
                existingStudent.currentSemester = existingStudent.currentSemester || 1;
                existingStudent.isActive = existingStudent.isActive !== false;
                await existingStudent.save();
                this.logger.log('Student record already exists:', existingStudent._id);
            }

            // Update User role from APPLICANT to STUDENT
            const userRecord = await this.userModel.findById(userId);
            if (userRecord && studentProfileImageUrl) {
                userRecord.profileImageUrl = studentProfileImageUrl;
            }
            if (userRecord && userRecord.role === UserRole.APPLICANT) {
                userRecord.role = UserRole.STUDENT;
                await userRecord.save();
                this.logger.log('User role updated from APPLICANT to STUDENT:', userRecord._id);
            } else if (userRecord && studentProfileImageUrl) {
                await userRecord.save();
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
    async sendMatriculationEmail(@Param('id') id: string, @Request() req) {
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

            this.appendAuditEntry(application, {
                action: 'matriculation_email_sent',
                description: 'Matriculation email was sent to the student.',
                actor: req.user,
                metadata: {
                    matriculationNumber: application.matriculationNumber,
                    recipientEmail: user.email,
                },
            });
            await application.save();

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
    private buildAdmissionLetterContext(application: any): {
        user: any;
        programName: string;
        programTypeCode: string;
        academicSessionName: string;
    } {
        const user = application.userId as any;
        const program = application.programId as any;
        const programType = program?.programTypeId as any;
        const academicSession = application.entryAcademicSession as any;

        if (!user || !user.email || !program || !programType || !academicSession) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Missing required data for admission letter delivery.',
                },
                HttpStatus.BAD_REQUEST
            );
        }

        const academicSessionName = academicSession?.sessionYear || academicSession?.name || '';
        const programTypeCode = programType?.type || programType?.code || programType?.name || '';
        const programName = program?.name || '';

        if (!academicSessionName || !programTypeCode || !programName) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to extract required admission letter details from application data.',
                },
                HttpStatus.BAD_REQUEST
            );
        }

        return {
            user,
            programName,
            programTypeCode,
            academicSessionName,
        };
    }

    private async getAcceptanceFeeDetails(): Promise<{ acceptanceFeeInWords: string; acceptanceFeeAmount: string }> {
        let acceptanceFeeInWords = '';
        let acceptanceFeeAmount = '';

        try {
            const acceptanceFeePayment = await this.paymentModel.findOne({
                paymentCode: 'acceptanceFee',
                active: true,
            });

            if (acceptanceFeePayment) {
                acceptanceFeeAmount = acceptanceFeePayment.amount.toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                });
                acceptanceFeeInWords = this.numberToWords(acceptanceFeePayment.amount);
            }
        } catch (error) {
            this.logger.error('Error fetching acceptance fee for admission letter:', error.message);
        }

        return { acceptanceFeeInWords, acceptanceFeeAmount };
    }

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

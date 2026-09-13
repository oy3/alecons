import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  TenancyAgreement,
  TenancyAgreementDocument,
  TenancyAgreementStatus,
} from "../schemas/tenancy-agreement.schema";
import { Student, StudentDocument } from "../schemas/student.schema";
import {
  Application,
  ApplicationDocument,
} from "../schemas/application.schema";
import { UploadService } from "./upload.service";
import { EmailService } from "./email.service";
import { AccommodationApplication, AccommodationApplicationDocument, AccommodationApplicantType, AccommodationApplicationStatus } from '../schemas/accommodation-application.schema';
import { SessionControl, SessionControlDocument } from '../schemas/session-control.schema';
import { AccommodationAssignment, AccommodationAssignmentDocument } from '../schemas/accommodation-assignment.schema';
import { AcademicSessionDocument } from '../schemas/academic-session.schema';
import { PaymentContext, PaymentTransaction, PaymentTransactionDocument } from '../schemas/payment-transaction.schema';
import * as path from "path";
import * as fs from "fs";

type ExternalAgreementInput = {
  userId: Types.ObjectId;
  externalResidentId: Types.ObjectId;
  accommodationApplicationId: Types.ObjectId;
  academicSessionId: Types.ObjectId;
  applicationNumber: string;
  tenantName: string;
  courseOfStudy: string;
  residentialAddress: string;
  phoneNumber: string;
  parentInfo: { name: string; phoneNumber: string };
  guarantorInfo: { name: string; phoneNumber: string; address: string; occupation: string; relationship: string };
  hostelInfo: { address: string; tenancyStartDate: string; tenancyEndDate: string };
};

const EXTERNAL_TENANCY_DOCUMENT_VERSION = 2;
const INTERNAL_TENANCY_DOCUMENT_VERSION = 1;

const GUARANTOR_RELATIONSHIP_LABELS: Record<string, string> = {
  father: 'Father',
  mother: 'Mother',
  uncle: 'Uncle',
  aunt: 'Aunt',
  brother: 'Brother',
  sister: 'Sister',
  grandfather: 'Grandfather',
  grandmother: 'Grandmother',
  other_blood_relative: 'Other blood relative',
};

@Injectable()
export class TenancyAgreementService {
  private readonly logger = new Logger(TenancyAgreementService.name);

  // Image URLs - use CDN in production, fallback to base64 in development
  private readonly logoUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/logo.png`
    : null;

  private readonly signatureUrl = process.env.SPACES_CDN_URL
    ? `${process.env.SPACES_CDN_URL}/assets/provost-sign.png`
    : null;

  constructor(
    @InjectModel(TenancyAgreement.name)
    private tenancyAgreementModel: Model<TenancyAgreementDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Application.name)
    private applicationModel: Model<ApplicationDocument>,
    @InjectModel(AccommodationApplication.name)
    private accommodationApplicationModel: Model<AccommodationApplicationDocument>,
    @InjectModel(SessionControl.name)
    private sessionControlModel: Model<SessionControlDocument>,
    @InjectModel(AccommodationAssignment.name)
    private accommodationAssignmentModel: Model<AccommodationAssignmentDocument>,
    @InjectModel(PaymentTransaction.name)
    private paymentTransactionModel: Model<PaymentTransactionDocument>,
    private uploadService: UploadService,
    private emailService: EmailService,
  ) { }

  private async emailExternalAllocationDocuments(
    accommodationApplicationId: Types.ObjectId,
    applicationNumber: string,
    externalResidentNumber: string,
    agreement: TenancyAgreementDocument,
    assignment: AccommodationAssignmentDocument,
  ) {
    const transactions = this.paymentTransactionModel.db.collection('paymenttransactions');
    const transaction = await transactions.findOne(
      {
        accommodationApplicationId,
        payerType: 'external_resident',
        paymentContext: 'accommodation_application',
        status: 'successful',
      },
      { sort: { paidAt: -1, createdAt: -1 } },
    );
    if (!transaction || !agreement.documentKey || !assignment.allocationSlipKey) return;

    const staleClaim = new Date(Date.now() - (10 * 60 * 1000));
    const claimed = await transactions.updateOne(
      {
        _id: transaction._id,
        $or: [
          { allocationDocumentsEmailStatus: { $exists: false } },
          { allocationDocumentsEmailStatus: 'failed' },
          {
            allocationDocumentsEmailStatus: 'sending',
            allocationDocumentsEmailAttemptedAt: { $lt: staleClaim },
          },
        ],
      },
      {
        $set: {
          allocationDocumentsEmailStatus: 'sending',
          allocationDocumentsEmailAttemptedAt: new Date(),
        },
        $inc: { allocationDocumentsEmailAttempts: 1 },
        $unset: { allocationDocumentsEmailError: '' },
      },
    );
    if (!claimed.modifiedCount) return;

    try {
      const [user, tenancyAgreement, allocationSlip] = await Promise.all([
        this.paymentTransactionModel.db.collection('users').findOne({ _id: transaction.userId }),
        this.uploadService.getFileBufferByKey(agreement.documentKey),
        this.uploadService.getFileBufferByKey(assignment.allocationSlipKey),
      ]);
      if (!user?.email) throw new Error('External resident email address was not found');

      await this.emailService.sendExternalAccommodationAllocatedEmail({
        to: user.email,
        firstName: user.firstName || 'Resident',
        applicationNumber,
        externalResidentNumber,
        hostel: (assignment.hostelId as any)?.name || 'Assigned hostel',
        block: (assignment.blockId as any)?.name || 'Assigned block',
        room: (assignment.roomId as any)?.name || 'Assigned room',
        slotNumber: assignment.slotNumber,
        tenancyAgreement,
        allocationSlip,
      });

      const deliveredAt = new Date();
      await transactions.updateOne(
        { _id: transaction._id, allocationDocumentsEmailStatus: 'sending' },
        {
          $set: {
            allocationDocumentsEmailStatus: 'sent',
            allocationDocumentsEmailedAt: deliveredAt,
          },
        },
      );
      await this.paymentTransactionModel.db.collection('accommodationaudits').updateOne(
        { accommodationApplicationId, action: 'allocation_documents_emailed' },
        {
          $setOnInsert: {
            accommodationApplicationId,
            action: 'allocation_documents_emailed',
            actorType: 'system',
            metadata: { transactionId: transaction._id, deliveredAt },
            createdAt: deliveredAt,
            updatedAt: deliveredAt,
          },
        },
        { upsert: true },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await transactions.updateOne(
        { _id: transaction._id, allocationDocumentsEmailStatus: 'sending' },
        {
          $set: {
            allocationDocumentsEmailStatus: 'failed',
            allocationDocumentsEmailError: message.slice(0, 500),
          },
        },
      );
      this.logger.error(`Could not email external accommodation documents for ${applicationNumber}: ${message}`);
    }
  }

  private tenancyConfiguration(session: AcademicSessionDocument | any) {
    const address = (process.env.ACCOMMODATION_HOSTEL_ADDRESS || '').trim();
    if (!address) {
      throw new BadRequestException('Accommodation hostel address is not configured');
    }
    if (!session?.startDate || !session?.endDate) {
      throw new BadRequestException('Academic session tenancy dates are not configured');
    }
    return {
      address,
      tenancyStartDate: new Date(session.startDate).toISOString().slice(0, 10),
      tenancyEndDate: new Date(session.endDate).toISOString().slice(0, 10),
    };
  }

  private async internalStudentContext(userId: string, requireOpen = false) {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundException('Student record not found');
    const student = await this.studentModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'firstName otherName lastName phone email gender profileImageUrl')
      .populate('applicationId', 'applicationNumber gender address profileImageUrl')
      .populate({
        path: 'programId',
        select: 'name programTypeId programModeId',
        populate: [
          { path: 'programTypeId', select: 'type' },
          { path: 'programModeId', select: 'mode description' },
        ],
      })
      .populate('academicSession', 'sessionYear title startDate endDate status active');
    if (!student) throw new NotFoundException('Student record not found');

    const session = student.academicSession as any;
    const control = await this.sessionControlModel.findOne({ academicSessionId: session._id }).lean();
    if (requireOpen && !control?.accommodation?.internalApplicationsOpen) {
      throw new BadRequestException('Internal accommodation applications are currently closed for this academic session');
    }
    if (requireOpen && !control?.accommodation?.internalPaymentId) {
      throw new BadRequestException('Internal accommodation payment is not configured for this academic session');
    }
    return { student, session, control, hostelInfo: this.tenancyConfiguration(session) };
  }

  private async ensureInternalAccommodationApplication(userId: string) {
    const context = await this.internalStudentContext(userId, true);
    const { student } = context;
    let application = await this.accommodationApplicationModel
      .findOne({ userId: new Types.ObjectId(userId), academicSessionId: (student.academicSession as any)._id || student.academicSession })
      .select('+agreementDraft');
    if (!application) {
      const admissionApplication = student.applicationId as any;
      const account = student.userId as any;
      const gender = String(admissionApplication?.gender || account?.gender || '').toLowerCase();
      if (!['male', 'female'].includes(gender)) {
        throw new BadRequestException('Student gender must be recorded before an accommodation application can be created');
      }
      application = await this.accommodationApplicationModel.create({
        applicationNumber: `ACC-${new Date().getFullYear()}-${student._id.toString().slice(-8).toUpperCase()}`,
        userId: new Types.ObjectId(userId),
        studentId: student._id,
        academicSessionId: (student.academicSession as any)._id || student.academicSession,
        applicantType: AccommodationApplicantType.INTERNAL,
        status: AccommodationApplicationStatus.AWAITING_AGREEMENT,
        category: 'student',
        gender,
      });
    }
    if (application.applicantType !== AccommodationApplicantType.INTERNAL) {
      throw new BadRequestException('This academic session already has a non-student accommodation application');
    }
    return { ...context, application };
  }

  async getInternalAccommodationOverview(userId: string) {
    const { student, session, control, hostelInfo } = await this.internalStudentContext(userId);
    const sessionId = (student.academicSession as any)._id || student.academicSession;
    const application = await this.accommodationApplicationModel
      .findOne({ userId: new Types.ObjectId(userId), academicSessionId: sessionId })
      .select('+agreementDraft')
      .lean();
    const agreement = application
      ? await this.tenancyAgreementModel.findOne({ accommodationApplicationId: application._id }).lean()
      : null;
    const assignment = application
      ? await this.accommodationAssignmentModel
        .findOne({ accommodationApplicationId: application._id, status: 'active' })
        .populate('hostelId', 'name').populate('blockId', 'name').populate('roomId', 'name capacity').lean()
      : null;
    const payment = application
      ? await this.paymentTransactionModel.findOne({
        accommodationApplicationId: application._id,
        paymentContext: PaymentContext.ACCOMMODATION_APPLICATION,
      }).sort({ createdAt: -1 }).lean()
      : null;
    const account = student.userId as any;
    const admissionApplication = student.applicationId as any;
    const isAllocated = application?.status === AccommodationApplicationStatus.ALLOCATED && !!assignment;
    const program = student.programId as any;
    const programLabel = [
      program?.programTypeId?.type,
      program?.programModeId?.mode || program?.programModeId?.description,
      program?.name,
    ].filter(Boolean).join(' ');

    return { success: true, data: {
      student: {
        fullName: [account?.firstName, account?.otherName, account?.lastName].filter(Boolean).join(' '),
        matriculationNumber: student.matriculationNumber,
        program: programLabel,
        session: session.sessionYear || session.title,
        profileImageUrl: account?.profileImageUrl || admissionApplication?.profileImageUrl || null,
        phoneNumber: account?.phone || '',
        residentialAddress: admissionApplication?.address || '',
      },
      configuration: {
        internalApplicationsOpen: !!control?.accommodation?.internalApplicationsOpen,
        paymentConfigured: !!control?.accommodation?.internalPaymentId,
        hostelAddress: hostelInfo.address,
        tenancyStartDate: hostelInfo.tenancyStartDate,
        tenancyEndDate: hostelInfo.tenancyEndDate,
        emergencyContacts: ['+234 916 000 8679', '+234 708 460 1610'],
      },
      application: application ? {
        id: application._id, applicationNumber: application.applicationNumber,
        status: application.status, paidAt: application.paidAt || null, allocatedAt: application.allocatedAt || null,
      } : null,
      agreement: agreement ? {
        reference: agreement.agreementReference, status: agreement.status,
        signedAt: agreement.agreementTerms?.signedAt || null, hasDraft: false, draftSavedAt: null,
      } : { status: 'not_started', hasDraft: !!application?.agreementDraft, draftSavedAt: application?.agreementDraftSavedAt || null },
      draft: application?.agreementDraft || null,
      payment: payment ? {
        transactionId: payment._id, reference: payment.reference,
        status: payment.status, paidAt: payment.paidAt || null,
      } : null,
      assignment: assignment ? {
        hostel: (assignment.hostelId as any)?.name || '', block: (assignment.blockId as any)?.name || '',
        room: (assignment.roomId as any)?.name || '', slotNumber: assignment.slotNumber,
      } : null,
      documents: { agreementAvailable: isAllocated, allocationSlipAvailable: isAllocated },
    } };
  }

  async saveInternalAgreementDraft(userId: string, draft: object) {
    const { student, application } = await this.ensureInternalAccommodationApplication(userId);
    const existingAgreement = await this.tenancyAgreementModel.exists({ studentId: student._id, accommodationApplicationId: application._id });
    if (existingAgreement) throw new BadRequestException('A signed agreement can no longer be edited');
    application.agreementDraft = draft as Record<string, unknown>;
    application.agreementDraftSavedAt = new Date();
    await application.save();
    return { success: true, data: { savedAt: application.agreementDraftSavedAt } };
  }

  /**
   * Get base64 encoded image from file system
   */
  private getBase64Image(imagePath: string): string | null {
    try {
      const fullPath = path.join(process.cwd(), imagePath);
      if (fs.existsSync(fullPath)) {
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Image = imageBuffer.toString("base64");
        const extension = path.extname(imagePath).substring(1);
        return `data:image/${extension};base64,${base64Image}`;
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to read image: ${imagePath}`, error.message);
      return null;
    }
  }

  /**
   * Get logo image source (URL or base64)
   */
  private getLogoSrc(): string | null {
    if (this.logoUrl) {
      return this.logoUrl;
    }
    // Fallback to local file in development
    return this.getBase64Image("packages/shared/assets/logo.png");
  }

  /**
   * Get signature image source (URL or base64)
   */
  private getSignatureSrc(): string | null {
    if (this.signatureUrl) {
      return this.signatureUrl;
    }
    // Fallback to local file in development
    return this.getBase64Image("packages/shared/assets/provost-sign.png");
  }

  /**
   * Submit tenancy agreement and process it
   */
  async submitTenancyAgreement(userId: string, agreementData: any) {
    try {
      this.logger.log(
        "Processing tenancy agreement submission for user:",
        userId
      );

      const { student, application: accommodationApplication, hostelInfo } =
        await this.ensureInternalAccommodationApplication(userId);

      if (agreementData?.agreementTerms?.agreedToTerms !== true) {
        throw new BadRequestException('You must accept the tenancy agreement before submitting');
      }

      // Check if student has already signed agreement
      const existingAgreement = await this.tenancyAgreementModel.findOne({
        studentId: student._id,
        accommodationApplicationId: accommodationApplication._id,
        academicSessionId: (student.academicSession as any)._id || student.academicSession,
      });

      if (existingAgreement) {
        throw new BadRequestException(
          "Tenancy agreement has already been signed"
        );
      }

      // Generate agreement reference
      const agreementReference = this.generateAgreementReference(
        student._id.toString(),
        new Date().getFullYear()
      );

      // Create tenancy agreement record
      const tenancyAgreement = new this.tenancyAgreementModel({
        studentId: student._id,
        userId: new Types.ObjectId(userId),
        accommodationApplicationId: accommodationApplication._id,
        academicSessionId: (student.academicSession as any)._id || student.academicSession,
        agreementReference,
        tenantName: agreementData.personalInfo.tenantName,
        courseOfStudy: agreementData.personalInfo.courseOfStudy,
        residentialAddress: agreementData.personalInfo.residentialAddress,
        phoneNumber: agreementData.personalInfo.phoneNumber,
        parentInfo: agreementData.parentInfo,
        guarantorInfo: agreementData.guarantorInfo,
        hostelInfo,
        agreementTerms: {
          agreedToTerms: agreementData.agreementTerms.agreedToTerms === true,
          signedAt: new Date(),
        },
        status: TenancyAgreementStatus.SIGNED_AWAITING_PAYMENT,
      });

      // Save agreement
      const savedAgreement = await tenancyAgreement.save();
      accommodationApplication.status = AccommodationApplicationStatus.AWAITING_PAYMENT;
      accommodationApplication.submittedAt = new Date();
      accommodationApplication.agreementDraft = undefined;
      accommodationApplication.agreementDraftSavedAt = undefined;
      await accommodationApplication.save();
      this.logger.log("Tenancy agreement saved with ID:", savedAgreement._id);

      this.logger.log(
        "Tenancy agreement process completed for:",
        agreementReference
      );

      return {
        success: true,
        data: {
          agreementId: savedAgreement._id,
          agreementReference,
          documentAvailable: false,
          status: TenancyAgreementStatus.SIGNED_AWAITING_PAYMENT,
          message: "Tenancy agreement signed and processed successfully",
        },
      };
    } catch (error) {
      this.logger.error("Error submitting tenancy agreement:", error.message);
      throw error;
    }
  }

  private async ensureInternalAccommodationDocuments(userId: string) {
    const { student } = await this.internalStudentContext(userId);
    const sessionId = (student.academicSession as any)._id || student.academicSession;
    const application = await this.accommodationApplicationModel.findOne({
      userId: new Types.ObjectId(userId), academicSessionId: sessionId,
      applicantType: AccommodationApplicantType.INTERNAL,
    });
    if (!application || application.status !== AccommodationApplicationStatus.ALLOCATED) {
      throw new BadRequestException('Accommodation documents become available after allocation');
    }
    const agreement = await this.tenancyAgreementModel
      .findOne({ accommodationApplicationId: application._id })
      .select('+documentKey +documentVersion');
    const assignment = await this.accommodationAssignmentModel
      .findOne({ accommodationApplicationId: application._id, status: 'active' })
      .select('+allocationSlipKey')
      .populate('hostelId', 'name').populate('blockId', 'name').populate('roomId', 'name').exec();
    if (!agreement || !assignment) throw new NotFoundException('The agreement or room allocation could not be found');

    if (!agreement.documentKey || agreement.documentVersion !== INTERNAL_TENANCY_DOCUMENT_VERSION) {
      const previousKey = agreement.documentKey;
      const previousUrl = agreement.documentUrl;
      agreement.documentKey = await this.generateInternalAgreementPDF(
        agreement, student.matriculationNumber, application.applicationNumber,
      );
      agreement.documentVersion = INTERNAL_TENANCY_DOCUMENT_VERSION;
      agreement.documentUrl = undefined;
      agreement.status = TenancyAgreementStatus.EXECUTED;
      await agreement.save();
      if (previousKey) await this.uploadService.deleteFromSpaces(previousKey).catch(() => undefined);
      if (previousUrl) await this.uploadService.deleteByUrl(previousUrl).catch(() => undefined);
    }

    if (!assignment.allocationSlipKey) {
      const pdfBuffer = await this.generateAllocationSlipPDFBuffer(agreement, assignment);
      const fileName = `allocation-slip-${application.applicationNumber}.pdf`;
      const upload = await this.uploadService.uploadPrivateStudentAccommodationDocument(
        { buffer: pdfBuffer, originalname: fileName, mimetype: 'application/pdf', size: pdfBuffer.length } as Express.Multer.File,
        student.matriculationNumber, application.applicationNumber, 'allocation_slip',
      );
      assignment.allocationSlipKey = upload.key;
      assignment.allocationSlipUrl = undefined;
      await assignment.save();
    }
    return { application, agreement, assignment };
  }

  async getInternalAccommodationDocument(userId: string, type: 'agreement' | 'allocation-slip') {
    const { application, agreement, assignment } = await this.ensureInternalAccommodationDocuments(userId);
    const key = type === 'agreement' ? agreement.documentKey : assignment.allocationSlipKey;
    if (!key) throw new NotFoundException('Accommodation document not found');
    return {
      buffer: await this.uploadService.getFileBufferByKey(key),
      contentType: 'application/pdf',
      filename: type === 'agreement'
        ? `tenancy-agreement-${agreement.agreementReference}.pdf`
        : `allocation-slip-${application.applicationNumber}.pdf`,
    };
  }

  async submitExternalTenancyAgreement(input: ExternalAgreementInput) {
    const existingAgreement = await this.tenancyAgreementModel.findOne({
      externalResidentId: input.externalResidentId,
      academicSessionId: input.academicSessionId,
    }).lean();
    if (existingAgreement) {
      throw new BadRequestException('Tenancy agreement has already been signed');
    }

    const agreementReference = this.generateAgreementReference(
      input.externalResidentId.toString(),
      new Date().getFullYear(),
    );
    return this.tenancyAgreementModel.create({
      userId: input.userId,
      externalResidentId: input.externalResidentId,
      accommodationApplicationId: input.accommodationApplicationId,
      academicSessionId: input.academicSessionId,
      agreementReference,
      tenantName: input.tenantName,
      courseOfStudy: input.courseOfStudy,
      residentialAddress: input.residentialAddress,
      phoneNumber: input.phoneNumber,
      parentInfo: input.parentInfo,
      guarantorInfo: input.guarantorInfo,
      hostelInfo: input.hostelInfo,
      agreementTerms: { agreedToTerms: true, signedAt: new Date() },
      status: TenancyAgreementStatus.SIGNED_AWAITING_PAYMENT,
    });
  }

  async getAgreementForAccommodationApplication(accommodationApplicationId: Types.ObjectId) {
    return this.tenancyAgreementModel.findOne({ accommodationApplicationId })
      .select('agreementReference documentUrl status agreementTerms.signedAt')
      .lean();
  }

  async finalizeExternalAccommodationDocuments(
    accommodationApplicationId: Types.ObjectId,
    applicationNumber: string,
    externalResidentNumber: string,
  ) {
    const agreement = await this.tenancyAgreementModel
      .findOne({ accommodationApplicationId })
      .select('+documentKey +documentVersion');
    const assignment = await this.accommodationAssignmentModel
      .findOne({ accommodationApplicationId, status: 'active' })
      .select('+allocationSlipKey')
      .populate('hostelId', 'name')
      .populate('blockId', 'name')
      .populate('roomId', 'name')
      .exec();
    if (!agreement || !assignment) throw new NotFoundException('The agreement or bed allocation could not be found');
    const documentPrefix = `external-residents/${externalResidentNumber}/documents/`;

    if (
      !agreement.documentKey?.startsWith(documentPrefix)
      || agreement.documentVersion !== EXTERNAL_TENANCY_DOCUMENT_VERSION
    ) {
      const previousPrivateKey = agreement.documentKey;
      const previousPublicUrl = agreement.documentUrl;
      const fileName = `tenancy-agreement-${agreement.agreementReference}.pdf`;
      const pdfBuffer = await this.generateTenancyAgreementPDFBuffer(agreement);
      const fileObject = { buffer: pdfBuffer, originalname: fileName, mimetype: 'application/pdf', size: pdfBuffer.length } as Express.Multer.File;
      const upload = await this.uploadService.uploadPrivateAccommodationDocument(
        fileObject,
        externalResidentNumber,
        applicationNumber,
        'tenancy_agreement',
      );
      agreement.documentKey = upload.key;
      agreement.documentVersion = EXTERNAL_TENANCY_DOCUMENT_VERSION;
      agreement.documentUrl = undefined;
      await agreement.save();
      if (previousPublicUrl) {
        await this.uploadService.deleteByUrl(previousPublicUrl).catch((error) => {
          this.logger.warn(`Could not remove superseded public tenancy agreement: ${error.message}`);
        });
      }
      if (previousPrivateKey) {
        await this.uploadService.deleteFromSpaces(previousPrivateKey).catch((error) => {
          this.logger.warn(`Could not remove superseded private tenancy agreement: ${error.message}`);
        });
      }
    }
    if (!assignment.allocationSlipKey?.startsWith(documentPrefix)) {
      const previousPrivateKey = assignment.allocationSlipKey;
      const previousPublicUrl = assignment.allocationSlipUrl;
      const fileName = `allocation-slip-${applicationNumber}.pdf`;
      const pdfBuffer = await this.generateAllocationSlipPDFBuffer(agreement, assignment);
      const fileObject = { buffer: pdfBuffer, originalname: fileName, mimetype: 'application/pdf', size: pdfBuffer.length } as Express.Multer.File;
      const upload = await this.uploadService.uploadPrivateAccommodationDocument(
        fileObject,
        externalResidentNumber,
        applicationNumber,
        'allocation_slip',
      );
      assignment.allocationSlipKey = upload.key;
      assignment.allocationSlipUrl = undefined;
      await assignment.save();
      if (previousPublicUrl) {
        await this.uploadService.deleteByUrl(previousPublicUrl).catch((error) => {
          this.logger.warn(`Could not remove superseded public allocation slip: ${error.message}`);
        });
      }
      if (previousPrivateKey) {
        await this.uploadService.deleteFromSpaces(previousPrivateKey).catch((error) => {
          this.logger.warn(`Could not remove superseded private allocation slip: ${error.message}`);
        });
      }
    }
    if (agreement.status !== TenancyAgreementStatus.EXECUTED) {
      agreement.status = TenancyAgreementStatus.EXECUTED;
      await agreement.save();
    }
    await this.emailExternalAllocationDocuments(
      accommodationApplicationId,
      applicationNumber,
      externalResidentNumber,
      agreement,
      assignment,
    );
    return { agreement, assignment };
  }

  /**
   * Generate agreement reference number
   */
  private generateAgreementReference(
    studentId: string,
    year: number = null
  ): string {
    const currentYear = year || new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-6);
    return `ALECONS-TA-${currentYear}-${studentId.slice(-6)}-${timestamp}`;
  }

  /**
   * Generate PDF document for the tenancy agreement and upload to DigitalOcean Spaces
   */
  private async generateInternalAgreementPDF(
    agreement: TenancyAgreementDocument,
    matriculationNumber: string,
    applicationNumber: string,
  ): Promise<string> {
    try {
      this.logger.log(
        "Generating PDF for agreement:",
        agreement.agreementReference
      );

      // Generate PDF filename with proper naming convention
      const fileName = `tenancy-agreement-${agreement.agreementReference}.pdf`;

      // TODO: Generate actual PDF content with all agreement details
      // For now, create a simple buffer as placeholder
      const pdfBuffer = await this.generateTenancyAgreementPDFBuffer(agreement);

      // Create a file-like object for upload service
      const fileObject = {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: "application/pdf",
        size: pdfBuffer.length,
      } as Express.Multer.File;

      const uploadResult = await this.uploadService.uploadPrivateStudentAccommodationDocument(
        fileObject,
        matriculationNumber,
        applicationNumber,
        'tenancy_agreement',
      );

      this.logger.log(
        "PDF generated and uploaded successfully:",
        uploadResult.key
      );
      return uploadResult.key;
    } catch (error) {
      this.logger.error("Error generating agreement PDF:", error.message);
      throw error;
    }
  }

  /**
   * Generate PDF buffer for tenancy agreement using Puppeteer
   */
  private async generateTenancyAgreementPDFBuffer(
    agreement: TenancyAgreementDocument
  ): Promise<Buffer> {
    let browser = null;
    try {
      const { launchPuppeteerBrowser } = await import("../utils/puppeteer-launch.util");
      const html = this.createTenancyAgreementHTML(agreement);

      browser = await launchPuppeteerBrowser();

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfData = await page.pdf({
        format: "A4",
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
        printBackground: true,
      });

      this.logger.log("Tenancy agreement PDF generated successfully");
      return Buffer.from(pdfData);
    } catch (error) {
      this.logger.error("Failed to generate tenancy agreement PDF:", error);
      throw error;
    } finally {
      if (browser) await browser.close();
    }
  }

  private async generateAllocationSlipPDFBuffer(
    agreement: TenancyAgreementDocument,
    assignment: AccommodationAssignmentDocument,
  ): Promise<Buffer> {
    let browser = null;
    try {
      const { launchPuppeteerBrowser } = await import('../utils/puppeteer-launch.util');
      browser = await launchPuppeteerBrowser();
      const page = await browser.newPage();
      const hostel = assignment.hostelId as any;
      const block = assignment.blockId as any;
      const room = assignment.roomId as any;
      const allocatedAt = new Date(assignment.allocatedAt).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos',
      });
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        @page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#202428;margin:0}.header{text-align:center;border-bottom:3px solid #c62828;padding-bottom:18px;margin-bottom:30px}.header h1{font-size:20px;color:#c62828;margin:0 0 6px}.title{text-align:center;font-size:24px;margin:34px 0}.reference{text-align:center;color:#62676d;margin-bottom:30px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #d8dcdf}.item{padding:16px;border-bottom:1px solid #d8dcdf}.item:nth-child(odd){border-right:1px solid #d8dcdf}.label{display:block;color:#687078;font-size:11px;text-transform:uppercase;margin-bottom:6px}.value{font-size:16px;font-weight:700}.notice{margin-top:30px;padding:16px;background:#f5f7f7}.footer{margin-top:50px;text-align:center;color:#687078;font-size:11px}
      </style></head><body><div class="header"><h1>ALEBIOSU COLLEGE OF NURSING SCIENCES</h1><div>Omuoke, Ekiti State, Nigeria</div></div><h2 class="title">HOSTEL ALLOCATION SLIP</h2><div class="reference">Agreement reference: ${agreement.agreementReference}</div><div class="grid"><div class="item"><span class="label">Resident</span><span class="value">${agreement.tenantName}</span></div><div class="item"><span class="label">Allocated on</span><span class="value">${allocatedAt}</span></div><div class="item"><span class="label">Hostel</span><span class="value">${hostel?.name || ''}</span></div><div class="item"><span class="label">Block</span><span class="value">${block?.name || ''}</span></div><div class="item"><span class="label">Room</span><span class="value">${room?.name || ''}</span></div><div class="item"><span class="label">Bed slot</span><span class="value">${assignment.slotNumber}</span></div><div class="item"><span class="label">Tenancy starts</span><span class="value">${agreement.hostelInfo.tenancyStartDate}</span></div><div class="item"><span class="label">Tenancy ends</span><span class="value">${agreement.hostelInfo.tenancyEndDate}</span></div></div><div class="notice">Present this allocation slip and your signed tenancy agreement during hostel check-in.</div><div class="footer">Generated electronically by ALECONS Institutional Management Platform</div></body></html>`, { waitUntil: 'networkidle0' });
      const pdfData = await page.pdf({ format: 'A4', printBackground: true });
      return Buffer.from(pdfData);
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * Create the HTML template for tenancy agreement matching the official format
   */
  private createTenancyAgreementHTML(
    agreement: TenancyAgreementDocument
  ): string {
    const signedDate = new Date(agreement.agreementTerms.signedAt);
    const day = signedDate.getDate();
    const month = signedDate.toLocaleDateString("en-GB", { month: "long" });
    const year = signedDate.getFullYear();
    const guarantorRelationship = GUARANTOR_RELATIONSHIP_LABELS[agreement.guarantorInfo.relationship]
      || agreement.guarantorInfo.relationship.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());

    // Get logo and signature sources using the same method as admission letter
    const logoSrc = this.getLogoSrc();
    const signatureSrc = this.getSignatureSrc();

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tenancy Agreement - ${agreement.tenantName}</title>
    <style>
        @page {
            margin: 0;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 10pt;
            line-height: 1.6;
            color: #000;
            margin: 0;
            padding: 0;
        }
        .letterhead {
            width: 100%;
            padding: 0 0 20px 0px;
            margin-bottom: 20px;
        }
        .letterhead-table {
            width: 100%;
            border-collapse: collapse;
        }
        .logo-cell {
            width: 80px;
            vertical-align: middle;
            text-align: left;
        }
        .logo-cell img {
            width: 80px;
            height: 80px;
            object-fit: contain;
        }
        .school-info-cell {
            vertical-align: middle;
            text-align: center;
            padding-left: 0px;
        }
        .school-name {
            font-size: 14pt;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-weight: bold;
            color: #C62828;
            margin: 0;
            text-transform: uppercase;
        }
        .school-subtitle {
            font-size: 10pt;
            font-style: italic;
            color: #444;
            margin: 0 0 8px 0;
        }
        .school-contact {
            font-size: 10pt;
            color: #444;
            margin: 0;
        }
        .content {
            padding: 0 50px;
        }
        .document-title {
            font-size: 14pt;
            font-weight: bold;
            text-align: center;
            margin: 40px 0;
            text-transform: uppercase;
        }
        .between-section {
            font-size: 10pt;
            font-weight: bold;
            text-align: center;
            margin: 30px 0;
            text-transform: uppercase;
        }
        .landlord-info {
            text-align: center;
            margin: 20px 0;
            line-height: 1.8;
        }
        .tenant-line {
            text-align: center;
            margin: 30px 0;
            padding-bottom: 10px;
        }
        .property-description {
            text-align: center;
            margin: 40px 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .date-section {
            text-align: center;
            margin: 40px 0;
            font-weight: bold;
            text-transform: uppercase;
        }
        .agreement-body {
            text-align: justify;
            margin: 30px 0;
            line-height: 1.6;
            page-break-before: always;
        }
        .whereas-section {
            margin: 20px 0;
        }
        .whereas-item {
            margin: 15px 0;
            padding-left: 20px;
        }
        .conditions-section {
            margin: 30px 0;
        }
        .condition-item {
            margin: 10px 0;
            text-align: justify;
            line-height: 1.5;
        }
        .signature-section {
            margin-top: 50px;
        }
        .signature-section p {
            margin: 8px 0;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="letterhead">
        <table class="letterhead-table">
            <tr>
                <td class="logo-cell">
                    ${logoSrc ? `<img src="${logoSrc}" alt="College Logo" />` : ''}
                </td>
                <td class="school-info-cell">
                    <div class="school-name">Alebiosu College of Nursing Sciences</div>
                    <div class="school-subtitle">Excellence in Nursing Education</div>
                    <div class="school-contact">
                        Omuo Oke, Ekiti State • Tel: +234 708 460 1610 • Email: info@alecons.edu.ng
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <div class="content">
        <div class="document-title">TENANCY AGREEMENT</div>

        <div class="between-section">BETWEEN:</div>

        <div class="landlord-info">
            <strong>MR OLUSEGUN</strong> (Trading under the name of<br>
            <strong>Alebiosu College of Arts and Sciences LTD</strong>)<br>
            <strong>(LANDLORD)</strong><br><br>
            <strong>AND</strong>
        </div>

        <div class="tenant-line">
            <strong>${agreement.tenantName}</strong><br>
            <strong>(TENANT)</strong>
        </div>

        <div class="property-description">
            IN RESPECT OF ONE (1) BED SPACE LYING, SITUATE AND BEING<br><br>
            AT <strong>${agreement.hostelInfo.address}</strong>
        </div>

        <div class="date-section">
            DATED THIS <strong>${day}</strong> DAY OF <strong>${month}</strong>, <strong>${year}</strong>
        </div>

        <div class="agreement-body">
            <p>This Tenancy Agreement is made on <strong>${day}</strong> day of <strong>${month}</strong>, <strong>${year}</strong></p>

            <p><strong>BETWEEN:</strong></p>

            <p><strong>MR OLUSEGUN</strong> (trading under name and style of ACAS HOSTEL) <strong>(Hereinafter called 'THE LANDLORD')</strong> which expression shall where the context so admits include her assignments, privies, representatives, attorneys and successors on the one part.</p>

            <p><strong>AND</strong></p>

            <p><strong>${agreement.tenantName}</strong> of <strong>${agreement.residentialAddress
      }</strong> <strong>(Hereinafter called 'THE TENANT')</strong>, which expression shall where the context so admits include his/her assignments, privies and successors on the second part.</p>

            <div class="whereas-section">
                <p><strong>WHEREAS</strong></p>
                
                <div class="whereas-item">
                    <strong>A.</strong> The Subject Matter of this agreement is a One (1) bed space within the hostel situated and located at <strong>${agreement.hostelInfo.address
      }</strong> (called ACAS hostel) which is owned by the Landlord and the Tenant wants to rent it.
                </div>

                <div class="whereas-item">
                    <strong>B.</strong> The Landlord built a hostel which comprises many rooms or apartments for commercial purposes, that is, renting the hostels to tenants. The Landlord will operate the hostel as ACAS HOSTEL.
                </div>

                <div class="whereas-item">
                    <strong>C.</strong> The applicable accommodation fee is payable in full before a bed space can be allocated. Signing this agreement does not constitute proof of payment or allocation. The tenancy period, once payment is verified and allocation is completed, runs from <strong> ${agreement.hostelInfo.tenancyStartDate
      }</strong> to <strong>${agreement.hostelInfo.tenancyEndDate
      }</strong></div>

                <div class="whereas-item">
                    <strong>D.</strong> Any major damage done to the hostel and everything in it by the Tenant, his/her family members, friends, employees or anybody under/claiming title from him/her while he/she is in possession shall be solely responsible for the repair, replacement or pay for it.
                </div>

                <div class="whereas-item">
                    <strong>E.</strong> That if the tenant is desirous of renewing or terminating this tenancy, he/she shall give the Landlord a Notice in writing of such intention at least one (1) month before the expiration of his or her tenancy. The Landlord has absolute discretion to accept the renewal or termination notice given by the tenant, while the landlord determines the desirability of the renewal upon such terms and conditions as he deems fit.
                </div>

                <div class="whereas-item">
                    <strong>F.</strong> The Landlord has agreed to let the said bed space to the Tenant and the latter has agreed to take the hostel subject to the terms and conditions hereinunder provided.
                </div>
            </div>

            <div class="conditions-section">
                <p><strong>THE LANDLORD HEREBY GIVES CONDITIONS TO THE TENANT WHICH THE TENANT AGREE AS FOLLOWS:</strong></p>

                <div class="condition-item">
                    <strong>1.</strong> The rent is payable yearly and in advance on or before the date the tenancy expires.
                </div>

                <div class="condition-item">
                    <strong>2.</strong> The Tenant shall provide the following data in full: Name of Tenant; Course of study; Residential address; Phone Number; Parents' Name and phone nos; Father's and/or Guarantor's name and Phone Number. Same shall be completed on ACAS Resident form and returned to the Management with a recent passport photograph attached to it with evidence of payment of rent and signed Agreement.
                </div>

                <div class="condition-item">
                    <strong>3.</strong> The above is a condition precedent to the allocation of bed space in a room.
                </div>

                <div class="condition-item">
                    <strong>4.</strong> The Tenant shall provide a person or means who is blood related to him or her as guarantor.
                </div>

                <div class="condition-item">
                    <strong>5.</strong> No partying of any form is allowed in the hostel, its surroundings/environment without the express permission and/or consent of the Management.
                </div>

                <div class="condition-item">
                    <strong>6.</strong> Any form of illicit or hard drugs is not permitted in the hostel, its surroundings or hostel premises. Wherever the tenant is found with any illicit/hard drug or traced to him/her, the tenancy will be automatically terminated and rent (whether reminder or all) shall not be refunded.
                </div>

                <div class="condition-item">
                    <strong>7.</strong> The tenant shall be responsible for the maintenance of the electrical appliances in the Apartment.
                </div>

                <div class="condition-item">
                    <strong>8.</strong> Drinking and selling of alcoholic drinks/substances is not permitted in the Hostel or its surroundings.
                </div>

                <div class="condition-item">
                    <strong>9.</strong> Fighting is prohibited in the Hostel and hostel facility. All disagreements/ must be reported to the management for quick resolution.
                </div>

                <div class="condition-item">
                    <strong>10.</strong> The tenant shall not belong to any occultic group/association or secret society. The only two religions permitted to be practiced in the hostel or apartment by the tenant are Christianity and Islam.
                </div>

                <div class="condition-item">
                    <strong>11.</strong> There shall be quarterly inspection of the Apartment at reasonable hours to inspect the conditions of the Apartment and its fixtures and fittings both exterior and interior by the management. Any damage done to the hostel must be fixed or replaced by the tenant between two (2) and four (4) weeks.
                </div>

                <div class="condition-item">
                    <strong>12.</strong> Where the Tenant fails to repair the damage done, the cost of repairing shall be calculated and deducted from the Tenant's rent and this will automatically reduce the rent tenure.
                </div>

                <div class="condition-item">
                    <strong>13.</strong> Any damage done to or in the Apartment and its appurtenances must be reported to the management and be replaced by the Tenant between two (2) and four (4) weeks. Failure on the part of the tenant will lead to the termination of tenancy and eviction of the tenant without refund.
                </div>

                <div class="condition-item">
                    <strong>14.</strong> No tenant is allowed to operate the generating set powering the Hostel where the hostel is situated except an authorized person. When provided, the generator will run for two hours daily between 7:30pm and 9:30pm.
                </div>

                <div class="condition-item">
                    <strong>15.</strong> Further to the above, the tenant with other tenants shall bear the cost of running and maintaining the generator set. The cost shall be shared equally and be paid at the beginning of each month into a designated account provided by the management.
                </div>

                <div class="condition-item">
                    <strong>16.</strong> Apart from the facilities and appliances/fittings provided in the hostel by the Management, no other appliances shall be used or connected to the Generator set whenever it is used in the Hostel. Similarly, only the bulbs in the Apartment and/or its surrounding must only be used with the Inverter. Neither should the tenant iron with the inverter at any time.
                </div>

                <div class="condition-item">
                    <strong>17.</strong> The tenant shall not make noise or constitute nuisance in the Hostel or Hostel environment.
                </div>

                <div class="condition-item">
                    <strong>18.</strong> No clothes, mats and other things shall be spread in and around the Apartment or Hostel except the designated place.
                </div>

                <div class="condition-item">
                    <strong>19.</strong> The interior of the Apartment shall be kept in good and tenantable conditions inclusive of reasonable repairs of the same and at the final determination of tenancy.
                </div>

                <div class="condition-item">
                    <strong>20.</strong> The Apartment shall not be for any illegal, immoral or improper purposes, hence the Demised premises is strictly for residential purpose.
                </div>

                <div class="condition-item">
                    <strong>21.</strong> The Apartment shall not be overcrowded at all times. There shall be a maximum number of eight (8) in the Management.
                </div>

                <div class="condition-item">
                    <strong>22.</strong> The Apartment shall not be subleased or assign or transfer or part to anybody or used as lien. Whenever any sublet is discovered, it shall be treated as breach of the agreement. The tenancy shall be terminated and the Tenant and/or anybody on the Apartment on his authority shall be evicted.
                </div>

                <div class="condition-item">
                    <strong>23.</strong> The tenant shall always do proper cleaning of the Apartment at all material time and bear the entire maintenance cost.
                </div>

                <div class="condition-item">
                    <strong>24.</strong> The tenant shall not carry out any alteration of the apartment hereby demised without the prior approval in writing of the Landlord.
                </div>

                <div class="condition-item">
                    <strong>25.</strong> The tenant shall keep the cooking gas (if any) in the kitchen only for safety purposes.
                </div>

                <div class="condition-item">
                    <strong>26.</strong> Further to the above, the use of heater, boiling ring, hot plate and any other appliances that consume electricity are prohibited.
                </div>

                <div class="condition-item">
                    <strong>27.</strong> To seek and secure the consent of the Landlord before doing or carrying out any structural amendment or alteration.
                </div>

                <div class="condition-item">
                    <strong>28.</strong> The tenant agrees with the Landlord/Management that the hostel is in good condition suitable for residential before he/she takes possession of the same. The fact he or she knew and acknowledged before executing this agreement.
                </div>

                <div class="condition-item">
                    <strong>29.</strong> The rent of the hostel shall be increased as deemed fit by the Management.
                </div>

                <div class="condition-item">
                    <strong>30.</strong> Whenever the landlord withholds her consent/authority on any issue such shall be final. Any violation of it by the tenant automatically terminates this tenancy and the Management shall eject the tenant.
                </div>

                <div class="condition-item">
                    <strong>31.</strong> Where any part of the Apartment is damaged or lost, the Tenant shall be held responsible for it and the landlord is free to take legal action to recover the damaged part/item in the Demised premises.
                </div>

                <div class="condition-item">
                    <strong>32.</strong> It is agreed that any breach of the covenants/conditions/terms above, same will be treated as notice to quit and determination of the tenancy. The tenants shall be ejected/evicted within two weeks without refund.
                </div>
            </div>

            <div class="signature-section">
                <p><strong>IN WITNESS WHERE OF,</strong> the parties hereto have executed this Tenancy Agreement electronically on the day and year first above written.</p> 
                
              <div style="margin: 25px 0 0 0;">
                <p> <strong>SIGNED BY</strong> the within named "<strong>LANDLORD</strong>"</p>
                <p  class="margin-bottom: 0px;"><strong>MR. OLUSEGUN</strong></p>
                <p class="margin: 0">(Trading under name and style of ACAS HOSTELS)</p>
              </div>
                
                <div style="margin: 20px 0 0 0;">
                  <p><strong>IN THE PRESENCE OF:</strong></p>
                    ${signatureSrc
        ? `<div style="margin: 10px 0;"><img src="${signatureSrc}" alt="Provost Signature" style="max-height: 50px; width: auto;" /></div>`
        : ""
      }
                        <p class="margin-bottom: 0px;"><strong>Yewande Akute</strong></p>
                  <p class="margin: 0px;"><i>Provost</i></p>
                </div>
                
                <div style="margin: 30px 0 0 0;">
                  <p><strong>SIGNED BY</strong> the within named "<strong>TENANT</strong>"</p>
                  <p><strong>${agreement.tenantName}</strong></p>
                </div>
                
                <div style="margin: 20px 0 0 0;">
                    <p><strong>IN THE PRESENCE OF:</strong></p>
                    <p>NAME: <strong>${agreement.guarantorInfo.name
      }</strong></p>
                    <p>ADDRESS: <strong>${agreement.guarantorInfo.address
      }</strong></p>
                    <p>OCCUPATION: <strong>${agreement.guarantorInfo.occupation
      }</strong></p>
                    <p>RELATIONSHIP: <strong>${guarantorRelationship}</strong></p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

}

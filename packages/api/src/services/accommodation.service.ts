import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomBytes, createHash } from "crypto";
import { Model, Types } from "mongoose";
import {
  AccommodationApplication,
  AccommodationApplicationDocument,
  AccommodationApplicantType,
  AccommodationApplicationStatus,
} from "../schemas/accommodation-application.schema";
import {
  ExternalResident,
  ExternalResidentDocument,
} from "../schemas/external-resident.schema";
import { Hostel, HostelDocument } from "../schemas/hostel.schema";
import {
  HostelBlock,
  HostelBlockDocument,
} from "../schemas/hostel-block.schema";
import { HostelRoom, HostelRoomDocument } from "../schemas/hostel-room.schema";
import {
  AccommodationAssignment,
  AccommodationAssignmentDocument,
} from "../schemas/accommodation-assignment.schema";
import {
  AccommodationAudit,
  AccommodationAuditDocument,
} from "../schemas/accommodation-audit.schema";
import {
  SessionControl,
  SessionControlDocument,
} from "../schemas/session-control.schema";
import {
  AcademicSession,
  AcademicSessionDocument,
} from "../schemas/academic-session.schema";
import { User, UserDocument, UserRole } from "../schemas/user.schema";
import {
  PaymentTransaction,
  PaymentTransactionDocument,
  PaymentStatus,
} from "../schemas/payment-transaction.schema";
import { PaymentsService } from "../payments/payments.service";
import { EmailService } from "./email.service";
import { UploadService } from "./upload.service";
import { TenancyAgreementService } from "./tenancy-agreement.service";

@Injectable()
export class AccommodationService {
  private readonly logger = new Logger(AccommodationService.name);

  constructor(
    @InjectModel(AccommodationApplication.name)
    private readonly applicationModel: Model<AccommodationApplicationDocument>,
    @InjectModel(ExternalResident.name)
    private readonly externalResidentModel: Model<ExternalResidentDocument>,
    @InjectModel(Hostel.name)
    private readonly hostelModel: Model<HostelDocument>,
    @InjectModel(HostelBlock.name)
    private readonly blockModel: Model<HostelBlockDocument>,
    @InjectModel(HostelRoom.name)
    private readonly roomModel: Model<HostelRoomDocument>,
    @InjectModel(AccommodationAssignment.name)
    private readonly assignmentModel: Model<AccommodationAssignmentDocument>,
    @InjectModel(AccommodationAudit.name)
    private readonly auditModel: Model<AccommodationAuditDocument>,
    @InjectModel(SessionControl.name)
    private readonly sessionControlModel: Model<SessionControlDocument>,
    @InjectModel(AcademicSession.name)
    private readonly academicSessionModel: Model<AcademicSessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PaymentTransaction.name)
    private readonly transactionModel: Model<PaymentTransactionDocument>,
    private readonly paymentsService: PaymentsService,
    private readonly emailService: EmailService,
    private readonly uploadService: UploadService,
    private readonly tenancyAgreementService: TenancyAgreementService,
  ) {}

  private tokenHash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private token() {
    return randomBytes(32).toString("base64url");
  }

  private async audit(
    applicationId: Types.ObjectId,
    action: string,
    actorType: string,
    actorId?: string,
    metadata: Record<string, unknown> = {},
  ) {
    await this.auditModel.create({
      accommodationApplicationId: applicationId,
      action,
      actorType,
      actorId:
        actorId && Types.ObjectId.isValid(actorId)
          ? new Types.ObjectId(actorId)
          : undefined,
      metadata,
    });
  }

  private async prepareExternalAllocationDocuments(
    application: AccommodationApplicationDocument,
  ) {
    if (
      application.applicantType !== AccommodationApplicantType.EXTERNAL
      || !application.externalResidentId
    ) return;

    try {
      const resident = await this.externalResidentModel
        .findById(application.externalResidentId)
        .select('externalResidentNumber')
        .lean();
      if (!resident?.externalResidentNumber) {
        throw new NotFoundException('External resident record not found');
      }
      await this.tenancyAgreementService.finalizeExternalAccommodationDocuments(
        application._id as Types.ObjectId,
        application.applicationNumber,
        resident.externalResidentNumber,
      );
    } catch (error) {
      this.logger.error(
        `Could not prepare or email external accommodation documents for ${application.applicationNumber}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async getOpenExternalControl() {
    const now = new Date();
    const session = await this.academicSessionModel
      .findOne({ active: true })
      .sort({ startDate: -1 })
      .lean();
    if (!session)
      throw new ConflictException("No active academic session is available");
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: session._id })
      .lean();
    const config = control?.accommodation;
    if (!config?.externalApplicationsOpen)
      throw new ConflictException(
        "External accommodation applications are currently closed",
      );
    if (config.applicationOpenAt && now < new Date(config.applicationOpenAt))
      throw new ConflictException(
        "External accommodation applications have not opened",
      );
    if (config.applicationCloseAt && now > new Date(config.applicationCloseAt))
      throw new ConflictException(
        "External accommodation applications have closed",
      );
    if (!config.externalPaymentId)
      throw new ConflictException(
        "External accommodation payment has not been configured",
      );
    return { session, config };
  }

  async externalConfig() {
    const now = new Date();
    const session = await this.academicSessionModel
      .findOne({ active: true })
      .sort({ startDate: -1 })
      .lean();
    if (!session) return { applicationsOpen: false, categories: [] };
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: session._id })
      .lean();
    const config = control?.accommodation;
    const categories = (config?.categories || [])
      .filter((category) => category.active)
      .map(({ code, label, isDefault }) => ({ code, label, isDefault }));
    const applicationsOpen = Boolean(
      config?.externalApplicationsOpen &&
        config.externalPaymentId &&
        (!config.applicationOpenAt ||
          now >= new Date(config.applicationOpenAt)) &&
        (!config.applicationCloseAt ||
          now <= new Date(config.applicationCloseAt)),
    );
    const hostelAddress = (process.env.ACCOMMODATION_HOSTEL_ADDRESS || '').trim();
    if (!hostelAddress) throw new BadRequestException('Accommodation hostel address is not configured');
    return {
      applicationsOpen,
      academicSession: {
        id: session._id,
        sessionYear: session.sessionYear,
        title: session.title,
      },
      categories,
      agreement: {
        hostelAddress,
        tenancyStartDate: session.startDate.toISOString().slice(0, 10),
        tenancyEndDate: session.endDate.toISOString().slice(0, 10),
      },
    };
  }

  async startExternal(input: {
    email: string;
    firstName: string;
    otherName?: string;
    lastName: string;
    phone: string;
  }) {
    const { session } = await this.getOpenExternalControl();
    const email = input.email.trim().toLowerCase();
    let user = await this.userModel.findOne({ email });
    if (user && user.role !== UserRole.EXTERNAL) {
      throw new ConflictException(
        "This email belongs to an existing ALECONS account and cannot be used for an external accommodation application",
      );
    }
    if (!user) {
      user = await this.userModel.create({
        email,
        firstName: input.firstName.trim(),
        otherName: input.otherName?.trim() || undefined,
        lastName: input.lastName.trim(),
        phone: input.phone.trim(),
        passwordHash: randomBytes(48).toString("base64url"),
        role: UserRole.EXTERNAL,
        isActive: true,
        isEmailVerified: false,
      });
    }

    let application = await this.applicationModel
      .findOne({ userId: user._id, academicSessionId: session._id })
      .select("+emailVerificationTokenHash +resumeTokenHash");
    if (!application) {
      application = await this.applicationModel.create({
        applicationNumber: `ACC-${new Date().getFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`,
        userId: user._id,
        academicSessionId: session._id,
        applicantType: AccommodationApplicantType.EXTERNAL,
        status: AccommodationApplicationStatus.AWAITING_EMAIL_VERIFICATION,
      });
    }

    const verificationToken = this.token();
    application.emailVerificationTokenHash = this.tokenHash(verificationToken);
    application.emailVerificationExpiresAt = new Date(
      Date.now() + 30 * 60 * 1000,
    );
    if (!application.emailVerifiedAt) {
      application.status =
        AccommodationApplicationStatus.AWAITING_EMAIL_VERIFICATION;
    }
    await application.save();

    const website = process.env.WEBSITE_URL || "https://alecons.edu.ng";
    await this.emailService.sendAccommodationVerificationEmail({
      to: email,
      firstName: user.firstName,
      verificationUrl: `${website}/accommodation/external?verificationToken=${encodeURIComponent(verificationToken)}`,
      expiresInMinutes: 30,
    });
    await this.audit(
      application._id as Types.ObjectId,
      "verification_email_sent",
      "public",
    );
    return {
      message:
        "Check your email for a secure link to continue your application",
    };
  }

  async verifyExternalEmail(token: string) {
    const application = await this.applicationModel
      .findOne({
        emailVerificationTokenHash: this.tokenHash(token),
        emailVerificationExpiresAt: { $gt: new Date() },
      })
      .select("+emailVerificationTokenHash +resumeTokenHash");
    if (!application)
      throw new BadRequestException(
        "This verification link is invalid or has expired",
      );

    const resumeToken = this.token();
    application.emailVerifiedAt = new Date();
    application.emailVerificationTokenHash = undefined;
    application.emailVerificationExpiresAt = undefined;
    application.resumeTokenHash = this.tokenHash(resumeToken);
    application.resumeTokenExpiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    );
    if (
      application.status ===
      AccommodationApplicationStatus.AWAITING_EMAIL_VERIFICATION
    ) {
      application.status = AccommodationApplicationStatus.DRAFT;
    }
    await application.save();
    await this.userModel.updateOne(
      { _id: application.userId, role: UserRole.EXTERNAL },
      { $set: { isEmailVerified: true } },
    );
    await this.audit(
      application._id as Types.ObjectId,
      "email_verified",
      "external",
      application.userId.toString(),
    );
    return {
      resumeToken,
      application: await this.externalApplicationView(
        application._id as Types.ObjectId,
      ),
    };
  }

  private async applicationFromResumeToken(token: string) {
    const application = await this.applicationModel
      .findOne({
        resumeTokenHash: this.tokenHash(token),
        resumeTokenExpiresAt: { $gt: new Date() },
      })
      .select("+resumeTokenHash");
    if (!application)
      throw new NotFoundException(
        "This accommodation link is invalid or has expired. Request a new link to continue.",
      );
    return application;
  }

  private async externalApplicationView(id: Types.ObjectId) {
    const application = await this.applicationModel
      .findById(id)
      .populate("academicSessionId", "sessionYear title")
      .populate("userId", "firstName otherName lastName email phone")
      .populate(
        "externalResidentId",
        "externalResidentNumber gender dob homeAddress category",
      )
      .lean();
    if (!application)
      throw new NotFoundException("Accommodation application not found");
    const assignment = await this.assignmentModel
      .findOne({
        accommodationApplicationId: application._id,
        status: "active",
      })
      .populate("hostelId", "name")
      .populate("blockId", "name")
      .populate("roomId", "name capacity")
      .lean();
    let agreement =
      await this.tenancyAgreementService.getAgreementForAccommodationApplication(
        application._id as Types.ObjectId,
      );
    let documentsReady = false;
    if (
      application.status === AccommodationApplicationStatus.ALLOCATED &&
      assignment &&
      agreement
    ) {
      try {
        const externalResidentNumber = (application.externalResidentId as any)
          ?.externalResidentNumber;
        if (!externalResidentNumber)
          throw new NotFoundException("External resident record not found");
        const documents =
          await this.tenancyAgreementService.finalizeExternalAccommodationDocuments(
            application._id as Types.ObjectId,
            application.applicationNumber,
            externalResidentNumber,
          );
        documentsReady = Boolean(
          documents.agreement.documentKey &&
            documents.assignment.allocationSlipKey,
        );
        agreement = {
          agreementReference: documents.agreement.agreementReference,
          status: documents.agreement.status,
          agreementTerms: {
            signedAt: documents.agreement.agreementTerms.signedAt,
          },
        } as any;
      } catch (error) {
        this.logger.error(
          `Could not prepare accommodation documents for ${application.applicationNumber}: ${error.message}`,
        );
      }
    }
    return {
      ...application,
      assignment,
      tenancyAgreement: agreement,
      documentsReady,
    };
  }

  async downloadExternalDocument(token: string, documentType: string) {
    if (!["tenancy-agreement", "allocation-slip"].includes(documentType)) {
      throw new BadRequestException("Unsupported accommodation document type");
    }
    const application = await this.applicationFromResumeToken(token);
    if (application.status !== AccommodationApplicationStatus.ALLOCATED) {
      throw new ConflictException(
        "Accommodation documents become available after allocation",
      );
    }
    const resident = await this.externalResidentModel
      .findById(application.externalResidentId)
      .select("externalResidentNumber")
      .lean();
    if (!resident)
      throw new NotFoundException("External resident record not found");
    const documents =
      await this.tenancyAgreementService.finalizeExternalAccommodationDocuments(
        application._id as Types.ObjectId,
        application.applicationNumber,
        resident.externalResidentNumber,
      );
    const key =
      documentType === "tenancy-agreement"
        ? documents.agreement.documentKey
        : documents.assignment.allocationSlipKey;
    if (!key)
      throw new NotFoundException(
        "The requested accommodation document is not ready",
      );
    return {
      buffer: await this.uploadService.getFileBufferByKey(key),
      fileName: `${documentType}-${application.applicationNumber}.pdf`,
    };
  }

  async resumeExternal(token: string) {
    const application = await this.applicationFromResumeToken(token);
    if (
      application.status === AccommodationApplicationStatus.AWAITING_PAYMENT
    ) {
      const agreement =
        await this.tenancyAgreementService.getAgreementForAccommodationApplication(
          application._id as Types.ObjectId,
        );
      if (!agreement) {
        application.status = AccommodationApplicationStatus.AWAITING_AGREEMENT;
        await application.save();
      }
    }
    return this.externalApplicationView(application._id as Types.ObjectId);
  }

  async completeExternal(
    token: string,
    input: {
      category: string;
      gender: string;
      dob: string;
      homeAddress: string;
    },
    profile?: Express.Multer.File,
  ) {
    const application = await this.applicationFromResumeToken(token);
    if (!application.emailVerifiedAt)
      throw new ConflictException("Email verification is required");
    if (
      ![
        AccommodationApplicationStatus.DRAFT,
        AccommodationApplicationStatus.AWAITING_AGREEMENT,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        "This accommodation application can no longer be edited",
      );
    }
    if (!profile && !application.externalResidentId)
      throw new BadRequestException("A profile photograph is required");
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: application.academicSessionId })
      .lean();
    const category = control?.accommodation?.categories?.find(
      (item) => item.active && item.code === input.category,
    );
    if (!category)
      throw new BadRequestException(
        "Select an available accommodation category",
      );

    let resident = application.externalResidentId
      ? await this.externalResidentModel.findById(
          application.externalResidentId,
        )
      : null;
    if (!resident) {
      resident = await this.externalResidentModel.create({
        userId: application.userId,
        externalResidentNumber: `EXT-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`,
        gender: input.gender,
        dob: new Date(input.dob),
        homeAddress: input.homeAddress.trim(),
        category: input.category,
      });
    } else {
      resident.gender = input.gender;
      resident.dob = new Date(input.dob);
      resident.homeAddress = input.homeAddress.trim();
      resident.category = input.category;
    }
    if (profile) {
      const upload = await this.uploadService.uploadPrivateAccommodationProfile(
        profile,
        resident.externalResidentNumber,
      );
      resident.profileImageKey = upload.key;
    }
    await resident.save();

    await this.userModel.updateOne(
      { _id: application.userId },
      { $set: { gender: input.gender, dob: new Date(input.dob) } },
    );
    application.externalResidentId = resident._id as Types.ObjectId;
    application.gender = input.gender;
    application.category = input.category;
    application.status = AccommodationApplicationStatus.AWAITING_AGREEMENT;
    await application.save();
    await this.audit(
      application._id as Types.ObjectId,
      "resident_details_completed",
      "external",
      application.userId.toString(),
      { category: input.category },
    );
    return this.externalApplicationView(application._id as Types.ObjectId);
  }

  async signExternalAgreement(
    token: string,
    input: {
      parentName: string;
      parentPhone: string;
      guarantorName: string;
      guarantorPhone: string;
      guarantorAddress: string;
      guarantorOccupation: string;
      guarantorRelationship: string;
      agreedToTerms: boolean;
    },
  ) {
    const application = await this.applicationFromResumeToken(token);
    if (
      application.status !==
        AccommodationApplicationStatus.AWAITING_AGREEMENT ||
      !application.externalResidentId
    ) {
      throw new ConflictException(
        "Resident details must be completed before signing the tenancy agreement",
      );
    }
    if (!input.agreedToTerms)
      throw new BadRequestException("You must agree to the tenancy terms");

    const existingAgreement =
      await this.tenancyAgreementService.getAgreementForAccommodationApplication(
        application._id as Types.ObjectId,
      );
    if (existingAgreement) {
      application.status = AccommodationApplicationStatus.AWAITING_PAYMENT;
      await application.save();
      return this.externalApplicationView(application._id as Types.ObjectId);
    }

    const [user, resident, session, control] = await Promise.all([
      this.userModel.findById(application.userId).lean(),
      this.externalResidentModel
        .findById(application.externalResidentId)
        .lean(),
      this.academicSessionModel.findById(application.academicSessionId).lean(),
      this.sessionControlModel
        .findOne({ academicSessionId: application.academicSessionId })
        .lean(),
    ]);
    if (!user || !resident || !session)
      throw new NotFoundException(
        "External resident application details are incomplete",
      );
    const category = control?.accommodation?.categories?.find(
      (item) => item.code === resident.category,
    );
    if (!category)
      throw new BadRequestException(
        "The selected accommodation category is unavailable",
      );

    const agreement =
      await this.tenancyAgreementService.submitExternalTenancyAgreement({
        userId: application.userId,
        externalResidentId: application.externalResidentId,
        accommodationApplicationId: application._id as Types.ObjectId,
        academicSessionId: application.academicSessionId,
        applicationNumber: application.applicationNumber,
        tenantName: [user.firstName, user.otherName, user.lastName]
          .filter(Boolean)
          .join(" "),
        courseOfStudy: category.label,
        residentialAddress: resident.homeAddress,
        phoneNumber: user.phone || "",
        parentInfo: {
          name: input.parentName.trim(),
          phoneNumber: input.parentPhone.trim(),
        },
        guarantorInfo: {
          name: input.guarantorName.trim(),
          phoneNumber: input.guarantorPhone.trim(),
          address: input.guarantorAddress.trim(),
          occupation: input.guarantorOccupation.trim(),
          relationship: input.guarantorRelationship.trim(),
        },
        hostelInfo: {
          address: (() => {
            const value = (process.env.ACCOMMODATION_HOSTEL_ADDRESS || '').trim();
            if (!value) throw new BadRequestException('Accommodation hostel address is not configured');
            return value;
          })(),
          tenancyStartDate: session.startDate.toISOString().slice(0, 10),
          tenancyEndDate: session.endDate.toISOString().slice(0, 10),
        },
      });

    application.status = AccommodationApplicationStatus.AWAITING_PAYMENT;
    application.submittedAt = new Date();
    await application.save();
    await this.audit(
      application._id as Types.ObjectId,
      "tenancy_agreement_signed",
      "external",
      application.userId.toString(),
      {
        agreementId: agreement._id.toString(),
        agreementReference: agreement.agreementReference,
      },
    );
    return this.externalApplicationView(application._id as Types.ObjectId);
  }

  private async assertExternalAgreementSigned(
    application: AccommodationApplicationDocument,
  ) {
    const agreement =
      await this.tenancyAgreementService.getAgreementForAccommodationApplication(
        application._id as Types.ObjectId,
      );
    if (!agreement) {
      throw new ConflictException(
        "A signed tenancy agreement is required before payment",
      );
    }
  }

  async initializeExternalPayment(token: string) {
    const application = await this.applicationFromResumeToken(token);
    if (
      application.status !== AccommodationApplicationStatus.AWAITING_PAYMENT
    ) {
      throw new ConflictException("This application is not awaiting payment");
    }
    await this.assertExternalAgreementSigned(application);
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: application.academicSessionId })
      .lean();
    const paymentId = control?.accommodation?.externalPaymentId;
    if (
      !control?.accommodation?.externalApplicationsOpen ||
      !paymentId ||
      !application.externalResidentId
    ) {
      throw new ConflictException(
        "External accommodation payment is unavailable",
      );
    }
    const user = await this.userModel.findById(application.userId).lean();
    if (!user)
      throw new NotFoundException("External resident account not found");
    const result =
      await this.paymentsService.initializeExternalAccommodationPayment({
        userId: application.userId.toString(),
        externalResidentId: application.externalResidentId.toString(),
        accommodationApplicationId: application._id.toString(),
        academicSessionId: application.academicSessionId.toString(),
        paymentId: paymentId.toString(),
        email: user.email,
      });
    await this.audit(
      application._id as Types.ObjectId,
      "payment_initialized",
      "external",
      application.userId.toString(),
      { reference: result.reference },
    );
    return result;
  }

  async externalPaymentOptions(token: string) {
    const application = await this.applicationFromResumeToken(token);
    if (
      application.status !== AccommodationApplicationStatus.AWAITING_PAYMENT
    ) {
      throw new ConflictException("This application is not awaiting payment");
    }
    await this.assertExternalAgreementSigned(application);
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: application.academicSessionId })
      .lean();
    const paymentId = control?.accommodation?.externalPaymentId;
    if (!paymentId)
      throw new ConflictException(
        "External accommodation payment is unavailable",
      );
    return this.paymentsService.getExternalAccommodationPaymentOptions(
      paymentId.toString(),
    );
  }

  async submitExternalManualTransfer(
    token: string,
    file?: Express.Multer.File,
  ) {
    const application = await this.applicationFromResumeToken(token);
    if (
      ![
        AccommodationApplicationStatus.AWAITING_PAYMENT,
        AccommodationApplicationStatus.PAYMENT_PENDING_REVIEW,
      ].includes(application.status)
    ) {
      throw new ConflictException("This application is not awaiting payment");
    }
    await this.assertExternalAgreementSigned(application);
    const control = await this.sessionControlModel
      .findOne({ academicSessionId: application.academicSessionId })
      .lean();
    const paymentId = control?.accommodation?.externalPaymentId;
    if (!paymentId || !application.externalResidentId || !file)
      throw new ConflictException(
        "External accommodation manual transfer is unavailable",
      );
    const transaction =
      await this.paymentsService.submitExternalAccommodationManualTransfer(
        {
          userId: application.userId.toString(),
          externalResidentId: application.externalResidentId.toString(),
          accommodationApplicationId: application._id.toString(),
          academicSessionId: application.academicSessionId.toString(),
          applicationNumber: application.applicationNumber,
          paymentId: paymentId.toString(),
        },
        file,
      );
    application.status = AccommodationApplicationStatus.PAYMENT_PENDING_REVIEW;
    await application.save();
    await this.audit(
      application._id as Types.ObjectId,
      "manual_transfer_submitted",
      "external",
      application.userId.toString(),
      { reference: transaction.reference },
    );
    return { reference: transaction.reference, status: transaction.status };
  }

  async verifyExternalPayment(token: string, reference: string) {
    const application = await this.applicationFromResumeToken(token);
    const transaction = await this.transactionModel.findOne({
      reference,
      accommodationApplicationId: application._id,
    });
    if (!transaction)
      throw new NotFoundException(
        "Payment attempt not found for this accommodation application",
      );
    await this.paymentsService.verifyPayment(reference);
    const refreshed = await this.transactionModel
      .findById(transaction._id)
      .lean();
    if (refreshed?.status === PaymentStatus.SUCCESSFUL)
      await this.allocateAutomatically(application._id as Types.ObjectId);
    return this.externalApplicationView(application._id as Types.ObjectId);
  }

  async allocateAutomatically(applicationId: Types.ObjectId, actorId?: string) {
    const application = await this.applicationModel.findById(applicationId);
    if (!application)
      throw new NotFoundException("Accommodation application not found");
    const existing = await this.assignmentModel.findOne({
      accommodationApplicationId: application._id,
      status: "active",
    });
    if (existing) return existing;
    if (
      ![
        AccommodationApplicationStatus.PAID_AWAITING_ALLOCATION,
        AccommodationApplicationStatus.ALLOCATED,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        "Accommodation payment must be verified before allocation",
      );
    }

    const hostels = await this.hostelModel
      .find({ gender: application.gender, active: true })
      .sort({ name: 1 })
      .lean();
    for (const hostel of hostels) {
      const blocks = await this.blockModel
        .find({
          hostelId: hostel._id,
          residentType: application.applicantType,
          active: true,
        })
        .sort({ allocationOrder: 1, name: 1 })
        .lean();
      for (const block of blocks) {
        const rooms = await this.roomModel
          .find({ blockId: block._id, active: true })
          .sort({ allocationOrder: 1, name: 1 })
          .lean();
        for (const room of rooms) {
          const occupied = new Set(
            (
              await this.assignmentModel
                .find({
                  academicSessionId: application.academicSessionId,
                  roomId: room._id,
                  status: "active",
                })
                .distinct("slotNumber")
            ).map(Number),
          );
          for (let slot = 1; slot <= room.capacity; slot += 1) {
            if (occupied.has(slot)) continue;
            try {
              const assignment = await this.assignmentModel.create({
                accommodationApplicationId: application._id,
                userId: application.userId,
                academicSessionId: application.academicSessionId,
                hostelId: hostel._id,
                blockId: block._id,
                roomId: room._id,
                slotNumber: slot,
                status: "active",
                allocatedBy: actorId ? new Types.ObjectId(actorId) : undefined,
                allocationSource: actorId ? "manual" : "automatic",
                allocatedAt: new Date(),
              });
              application.status = AccommodationApplicationStatus.ALLOCATED;
              application.allocatedAt = assignment.allocatedAt;
              await application.save();
              await this.audit(
                application._id as Types.ObjectId,
                "bed_allocated",
                actorId ? "staff" : "system",
                actorId,
                {
                  hostelId: hostel._id,
                  blockId: block._id,
                  roomId: room._id,
                  slotNumber: slot,
                },
              );
              await this.prepareExternalAllocationDocuments(application);
              return assignment;
            } catch (error: any) {
              if (error?.code !== 11000) throw error;
            }
          }
        }
      }
    }
    application.status =
      AccommodationApplicationStatus.PAID_AWAITING_ALLOCATION;
    await application.save();
    await this.audit(
      application._id as Types.ObjectId,
      "allocation_waitlisted",
      "system",
      undefined,
      { reason: "No matching bed space is available" },
    );
    return null;
  }

  async manualAllocate(
    applicationId: string,
    roomId: string,
    slotNumber: number | undefined,
    actorId: string,
    note?: string,
  ) {
    const application = await this.applicationModel.findById(applicationId);
    const room = await this.roomModel.findById(roomId);
    if (!application || !room)
      throw new NotFoundException("Application or room not found");
    if (
      ![
        AccommodationApplicationStatus.PAID_AWAITING_ALLOCATION,
        AccommodationApplicationStatus.ALLOCATED,
      ].includes(application.status)
    ) {
      throw new ConflictException(
        "Only paid accommodation applications can be allocated",
      );
    }
    if (!room.active) throw new ConflictException("Selected room is inactive");
    if (
      slotNumber !== undefined &&
      (slotNumber < 1 || slotNumber > room.capacity)
    ) {
      throw new BadRequestException(
        "Slot number is outside this room capacity",
      );
    }
    const block = await this.blockModel.findById(room.blockId);
    const hostel = block
      ? await this.hostelModel.findById(block.hostelId)
      : null;
    if (
      !block ||
      !hostel ||
      !block.active ||
      !hostel.active ||
      block.residentType !== application.applicantType ||
      hostel.gender !== application.gender
    ) {
      throw new ConflictException(
        "Selected room does not match the resident type and gender",
      );
    }
    const session = await this.applicationModel.db.startSession();
    let assignment: AccommodationAssignmentDocument | null = null;
    let transferred = false;
    let assignedSlotNumber: number | undefined;
    let previousAssignment: Record<string, unknown> | null = null;
    const normalizedNote = note?.trim();
    try {
      await session.withTransaction(async () => {
        const old = await this.assignmentModel
          .findOne({
            accommodationApplicationId: application._id,
            status: "active",
          })
          .session(session);
        if (old) {
          if (old.roomId.toString() === room._id.toString()) {
            throw new ConflictException(
              "Select a different room for this transfer",
            );
          }
          if (!normalizedNote)
            throw new BadRequestException("A transfer reason is required");
          const [oldHostel, oldBlock, oldRoom] = await Promise.all([
            this.hostelModel
              .findById(old.hostelId)
              .select("name")
              .session(session)
              .lean(),
            this.blockModel
              .findById(old.blockId)
              .select("name")
              .session(session)
              .lean(),
            this.roomModel
              .findById(old.roomId)
              .select("name")
              .session(session)
              .lean(),
          ]);
          previousAssignment = {
            hostelId: old.hostelId,
            hostelName: oldHostel?.name,
            blockId: old.blockId,
            blockName: oldBlock?.name,
            roomId: old.roomId,
            roomName: oldRoom?.name,
            slotNumber: old.slotNumber,
          };
        }

        const occupiedSlots = new Set(
          (
            await this.assignmentModel
              .find({
                academicSessionId: application.academicSessionId,
                roomId: room._id,
                status: "active",
              })
              .distinct("slotNumber")
              .session(session)
          ).map(Number),
        );
        assignedSlotNumber =
          slotNumber ??
          Array.from({ length: room.capacity }, (_, index) => index + 1).find(
            (candidate) => !occupiedSlots.has(candidate),
          );
        if (!assignedSlotNumber || occupiedSlots.has(assignedSlotNumber)) {
          throw new ConflictException(
            "The selected room no longer has an available bed space",
          );
        }

        if (old) {
          old.status = "transferred";
          await old.save({ session });
          transferred = true;
        }

        [assignment] = await this.assignmentModel.create(
          [
            {
              accommodationApplicationId: application._id,
              userId: application.userId,
              academicSessionId: application.academicSessionId,
              hostelId: hostel._id,
              blockId: block._id,
              roomId: room._id,
              slotNumber: assignedSlotNumber,
              status: "active",
              allocatedBy: new Types.ObjectId(actorId),
              allocationSource: "manual",
              allocatedAt: new Date(),
              note: normalizedNote,
            },
          ],
          { session },
        );

        await this.applicationModel.updateOne(
          { _id: application._id },
          {
            $set: {
              status: AccommodationApplicationStatus.ALLOCATED,
              allocatedAt: assignment.allocatedAt,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
    if (!assignment)
      throw new ConflictException("The bed allocation could not be completed");
    await this.audit(
      application._id as Types.ObjectId,
      transferred ? "bed_transferred" : "bed_allocated",
      "staff",
      actorId,
      {
        from: previousAssignment,
        to: {
          hostelId: hostel._id,
          hostelName: hostel.name,
          blockId: block._id,
          blockName: block.name,
          roomId: room._id,
          roomName: room.name,
          slotNumber: assignedSlotNumber,
        },
        reason: normalizedNote,
      },
    );
    if (!transferred) {
      await this.prepareExternalAllocationDocuments(application);
    }
    return assignment;
  }

  async listApplications(filters: {
    sessionId?: string;
    status?: string;
    applicantType?: string;
    page?: number;
    limit?: number;
  }) {
    const query: any = {};
    if (filters.sessionId)
      query.academicSessionId = new Types.ObjectId(filters.sessionId);
    if (filters.status) query.status = filters.status;
    if (filters.applicantType) query.applicantType = filters.applicantType;
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit || 25)));
    const [items, total] = await Promise.all([
      this.applicationModel
        .find(query)
        .populate("userId", "firstName otherName lastName email phone")
        .populate("academicSessionId", "sessionYear title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.applicationModel.countDocuments(query),
    ]);
    const ids = items.map((item) => item._id);
    const assignments = await this.assignmentModel
      .find({ accommodationApplicationId: { $in: ids }, status: "active" })
      .populate("hostelId blockId roomId")
      .lean();
    const byApplication = new Map(
      assignments.map((assignment) => [
        assignment.accommodationApplicationId.toString(),
        assignment,
      ]),
    );
    return {
      items: items.map((item) => ({
        ...item,
        assignment: byApplication.get(item._id.toString()) || null,
      })),
      total,
      page,
      limit,
    };
  }

  async inventory(sessionId?: string) {
    let academicSessionId: Types.ObjectId | undefined;
    if (sessionId) {
      if (!Types.ObjectId.isValid(sessionId))
        throw new BadRequestException("Invalid academic session ID");
      academicSessionId = new Types.ObjectId(sessionId);
    } else {
      const activeSession = await this.academicSessionModel
        .findOne({ active: true })
        .sort({ startDate: -1 })
        .select("_id")
        .lean();
      academicSessionId = activeSession?._id as Types.ObjectId | undefined;
    }
    const [hostels, blocks, rooms] = await Promise.all([
      this.hostelModel.find().sort({ active: -1, name: 1 }).lean(),
      this.blockModel.find().sort({ active: -1, allocationOrder: 1 }).lean(),
      this.roomModel.find().sort({ active: -1, allocationOrder: 1 }).lean(),
    ]);
    const occupancy = academicSessionId
      ? await this.assignmentModel.aggregate([
          { $match: { academicSessionId, status: "active" } },
          { $group: { _id: "$roomId", occupiedCount: { $sum: 1 } } },
        ])
      : [];
    const occupiedByRoom = new Map(
      occupancy.map((item) => [item._id.toString(), item.occupiedCount]),
    );
    return {
      academicSessionId,
      hostels,
      blocks,
      rooms: rooms.map((room) => {
        const occupiedCount = occupiedByRoom.get(room._id.toString()) || 0;
        return {
          ...room,
          occupiedCount,
          availableCount: Math.max(0, room.capacity - occupiedCount),
        };
      }),
    };
  }

  async createHostel(input: any, actorId: string) {
    const record = await this.hostelModel.create(input);
    await this.auditModel.create({
      action: "hostel_created",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "hostel",
        inventoryId: record._id,
        name: record.name,
      },
    });
    return record;
  }

  async createBlock(input: any, actorId: string) {
    const hostelId = new Types.ObjectId(input.hostelId);
    if (!(await this.hostelModel.exists({ _id: hostelId }))) {
      throw new NotFoundException("Hostel not found");
    }
    const record = await this.blockModel.create({ ...input, hostelId });
    await this.auditModel.create({
      action: "block_created",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "block",
        inventoryId: record._id,
        hostelId,
        name: record.name,
      },
    });
    return record;
  }

  async createRoom(input: any, actorId: string) {
    const blockId = new Types.ObjectId(input.blockId);
    if (!(await this.blockModel.exists({ _id: blockId }))) {
      throw new NotFoundException("Hostel block not found");
    }
    const record = await this.roomModel.create({ ...input, blockId });
    await this.auditModel.create({
      action: "room_created",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "room",
        inventoryId: record._id,
        blockId,
        name: record.name,
        capacity: record.capacity,
      },
    });
    return record;
  }

  async updateHostel(id: string, input: any, actorId: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid hostel ID");
    if (!Object.keys(input).length)
      throw new BadRequestException(
        "Provide at least one hostel field to update",
      );
    const record = await this.hostelModel.findById(id);
    if (!record) throw new NotFoundException("Hostel not found");
    if (input.gender && input.gender !== record.gender) {
      const hasAssignments = await this.assignmentModel.exists({
        hostelId: record._id,
        status: "active",
      });
      if (hasAssignments) {
        throw new ConflictException(
          "Hostel gender cannot be changed while it has active allocations",
        );
      }
    }
    const before = {
      name: record.name,
      gender: record.gender,
      description: record.description || "",
    };
    if (input.name !== undefined) record.name = input.name;
    if (input.gender !== undefined) record.gender = input.gender;
    if (input.description !== undefined) record.description = input.description;
    try {
      await record.save();
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "A hostel with this name and gender already exists",
        );
      throw error;
    }
    await this.auditModel.create({
      action: "hostel_updated",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "hostel",
        inventoryId: record._id,
        before,
        after: {
          name: record.name,
          gender: record.gender,
          description: record.description || "",
        },
      },
    });
    return record;
  }

  async updateBlock(id: string, input: any, actorId: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid hostel block ID");
    if (!Object.keys(input).length)
      throw new BadRequestException(
        "Provide at least one block field to update",
      );
    const record = await this.blockModel.findById(id);
    if (!record) throw new NotFoundException("Hostel block not found");
    if (input.residentType && input.residentType !== record.residentType) {
      const hasAssignments = await this.assignmentModel.exists({
        blockId: record._id,
        status: "active",
      });
      if (hasAssignments) {
        throw new ConflictException(
          "Block resident type cannot be changed while it has active allocations",
        );
      }
    }
    const before = {
      name: record.name,
      residentType: record.residentType,
      allocationOrder: record.allocationOrder,
    };
    if (input.name !== undefined) record.name = input.name;
    if (input.residentType !== undefined)
      record.residentType = input.residentType;
    if (input.allocationOrder !== undefined)
      record.allocationOrder = input.allocationOrder;
    try {
      await record.save();
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "A block with this name already exists in the hostel",
        );
      throw error;
    }
    await this.auditModel.create({
      action: "block_updated",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "block",
        inventoryId: record._id,
        hostelId: record.hostelId,
        before,
        after: {
          name: record.name,
          residentType: record.residentType,
          allocationOrder: record.allocationOrder,
        },
      },
    });
    return record;
  }

  async updateRoom(id: string, input: any, actorId: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid hostel room ID");
    if (!Object.keys(input).length)
      throw new BadRequestException(
        "Provide at least one room field to update",
      );
    const record = await this.roomModel.findById(id);
    if (!record) throw new NotFoundException("Hostel room not found");
    if (input.capacity !== undefined && input.capacity < record.capacity) {
      const highestOccupiedSlot = await this.assignmentModel
        .findOne({ roomId: record._id, status: "active" })
        .sort({ slotNumber: -1 })
        .select("slotNumber")
        .lean();
      if (
        highestOccupiedSlot &&
        input.capacity < highestOccupiedSlot.slotNumber
      ) {
        throw new ConflictException(
          `Room capacity cannot be lower than occupied slot ${highestOccupiedSlot.slotNumber}`,
        );
      }
    }
    const before = {
      name: record.name,
      capacity: record.capacity,
      allocationOrder: record.allocationOrder,
    };
    if (input.name !== undefined) record.name = input.name;
    if (input.capacity !== undefined) record.capacity = input.capacity;
    if (input.allocationOrder !== undefined)
      record.allocationOrder = input.allocationOrder;
    try {
      await record.save();
    } catch (error: any) {
      if (error?.code === 11000)
        throw new ConflictException(
          "A room with this name already exists in the block",
        );
      throw error;
    }
    await this.auditModel.create({
      action: "room_updated",
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: "room",
        inventoryId: record._id,
        blockId: record.blockId,
        before,
        after: {
          name: record.name,
          capacity: record.capacity,
          allocationOrder: record.allocationOrder,
        },
      },
    });
    return record;
  }

  async updateInventoryStatus(
    type: "hostel" | "block" | "room",
    id: string,
    active: boolean,
    actorId: string,
  ) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException("Invalid inventory record ID");
    const models = {
      hostel: this.hostelModel,
      block: this.blockModel,
      room: this.roomModel,
    } as const;
    const record = await (models[type] as Model<any>).findById(id);
    if (!record)
      throw new NotFoundException(
        `${type[0].toUpperCase()}${type.slice(1)} not found`,
      );
    record.active = active;
    await record.save();
    await this.auditModel.create({
      action: `${type}_${active ? "activated" : "deactivated"}`,
      actorType: "staff",
      actorId: new Types.ObjectId(actorId),
      metadata: {
        inventoryType: type,
        inventoryId: record._id,
        name: record.name,
      },
    });
    return record;
  }

  async retryPendingAllocations(actorId: string) {
    const pending = await this.applicationModel
      .find({ status: AccommodationApplicationStatus.PAID_AWAITING_ALLOCATION })
      .select("_id");
    let allocated = 0;
    for (const application of pending)
      if (
        await this.allocateAutomatically(
          application._id as Types.ObjectId,
          actorId,
        )
      )
        allocated += 1;
    return {
      scanned: pending.length,
      allocated,
      remaining: pending.length - allocated,
    };
  }

  async auditTrail(applicationId: string) {
    return this.auditModel
      .find({ accommodationApplicationId: new Types.ObjectId(applicationId) })
      .populate("actorId", "firstName otherName lastName email")
      .sort({ createdAt: -1 })
      .lean();
  }
}

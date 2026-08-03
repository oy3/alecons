import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
    SessionControl,
    SessionControlDocument,
} from "../schemas/session-control.schema";
import { Payment, PaymentDocument } from "../schemas/payment.schema";
import {
    Application,
    AdmissionDecision,
    ApplicationDocument,
    ApplicationStatus,
} from "../schemas/application.schema";

export interface AdmissionFlowConfig {
    entranceExamEnabled: boolean;
    screeningEnabled: boolean;
}

interface AdmissionFlowApplicationContext {
    entryAcademicSession?:
    | Types.ObjectId
    | { _id?: Types.ObjectId | string }
    | string;
    isJambExempt?: boolean;
}

interface ApplicationStageCarrier {
    currentStage: number;
    entryAcademicSession?:
    | Types.ObjectId
    | { _id?: Types.ObjectId | string }
    | string;
    isJambExempt?: boolean;
    save?: () => Promise<unknown>;
    markModified?: (path: string) => void;
}

const DEFAULT_SESSION_CONTROLS: Array<{ name: string; active: boolean }> = [
    { name: "application", active: false },
    { name: "admissionProcessing", active: false },
    { name: "entranceExam", active: true },
    { name: "screening", active: true },
    { name: "courseRegistration", active: false },
    { name: "resultUpload", active: false },
    { name: "resultRelease", active: false },
    { name: "applicantPaystackPayments", active: true },
    { name: "applicantManualTransferPayments", active: true },
    { name: "studentPaystackPayments", active: true },
    { name: "studentManualTransferPayments", active: true },
];

@Injectable()
export class SessionControlsService {
    constructor(
        @InjectModel(SessionControl.name)
        private sessionControlModel: Model<SessionControlDocument>,
        @InjectModel(Payment.name)
        private paymentModel: Model<PaymentDocument>,
        @InjectModel(Application.name)
        private applicationModel: Model<ApplicationDocument>,
    ) { }

    private getDefaultControls() {
        return DEFAULT_SESSION_CONTROLS.map((control) => ({ ...control }));
    }

    private normalizeControls(
        controls: Array<{
            name: string;
            active: boolean;
            description?: string;
        }> = [],
    ) {
        const controlMap = new Map(
            controls.map((control) => [control.name, control]),
        );

        const normalizedControls = DEFAULT_SESSION_CONTROLS.map(
            (defaultControl) => {
                const existingControl = controlMap.get(defaultControl.name);
                return existingControl
                    ? {
                        ...existingControl,
                        active: existingControl.active,
                    }
                    : { ...defaultControl };
            },
        );

        const extraControls = controls.filter(
            (control) =>
                !DEFAULT_SESSION_CONTROLS.some(
                    (defaultControl) => defaultControl.name === control.name,
                ),
        );

        const changed = DEFAULT_SESSION_CONTROLS.some(
            (defaultControl) => !controlMap.has(defaultControl.name),
        );

        return {
            controls: [...normalizedControls, ...extraControls],
            changed,
        };
    }

    private async ensureDefaultControls(sessionControl: SessionControlDocument) {
        const { controls, changed } = this.normalizeControls(
            sessionControl.controls || [],
        );

        const normalizedPayments = (sessionControl.payments || []).map((payment: any) => ({
            paymentId: payment.paymentId,
            active: payment.active,
            // Existing controls predate audience scoping and remain available to both groups.
            eligibleStudentGroups: payment.eligibleStudentGroups?.length
                ? payment.eligibleStudentGroups
                : ['new', 'returning'],
        }));
        const paymentsChanged = normalizedPayments.some((payment: any, index: number) =>
            !(sessionControl.payments?.[index] as any)?.eligibleStudentGroups?.length,
        );

        if (changed || paymentsChanged) {
            sessionControl.controls = controls;
            sessionControl.payments = normalizedPayments;
            await sessionControl.save();
        }

        return sessionControl;
    }

    private extractSessionId(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string
            | undefined,
    ): string | null {
        if (!academicSessionId) {
            return null;
        }

        if (typeof academicSessionId === "string") {
            return academicSessionId;
        }

        if (academicSessionId instanceof Types.ObjectId) {
            return academicSessionId.toString();
        }

        if (academicSessionId._id) {
            return academicSessionId._id.toString();
        }

        return null;
    }

    private shouldAllowJambExemptEntranceExam(
        application?: AdmissionFlowApplicationContext,
    ) {
        return application?.isJambExempt === true;
    }

    async createDefaultControls(
        academicSessionId: Types.ObjectId,
        updatedBy: string,
    ): Promise<SessionControl> {
        // Get all available payments
        const payments = await this.paymentModel.find({ active: true });

        // Create payment controls for all active payments
        const paymentControls = payments.map((payment) => ({
            paymentId: payment._id,
            active: false,
            eligibleStudentGroups: ['new', 'returning'],
        }));

        const sessionControl = new this.sessionControlModel({
            academicSessionId,
            controls: this.getDefaultControls(),
            payments: paymentControls,
            updatedBy: new Types.ObjectId(updatedBy),
        });

        return sessionControl.save();
    }

    async findBySessionId(academicSessionId: string): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel
            .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) })
            .populate("payments.paymentId", "name description amount paymentCode")
            .exec();

        if (!sessionControl) {
            throw new NotFoundException("Session controls not found");
        }

        return this.ensureDefaultControls(sessionControl);
    }

    async updateControls(
        academicSessionId: string,
        controlsData: {
            controls?: Array<{ name: string; active: boolean }>;
            payments?: Array<{
                paymentId: string;
                active: boolean;
                eligibleStudentGroups?: Array<'new' | 'returning'>;
            }>;
        },
        updatedBy: string,
    ): Promise<{ sessionControl: SessionControl; expiredApplicants: Array<{ email: string; firstName: string }> }> {
        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!sessionControl) {
            throw new NotFoundException("Session controls not found");
        }

        await this.ensureDefaultControls(sessionControl);

        // Detect if the application control is being toggled OFF
        let shouldExpireStaleApplications = false;
        if (controlsData.controls) {
            const previousApplicationControl = sessionControl.controls.find(
                (c) => c.name === "application",
            );
            const incomingApplicationControl = controlsData.controls.find(
                (c) => c.name === "application",
            );
            if (
                previousApplicationControl?.active === true &&
                incomingApplicationControl?.active === false
            ) {
                shouldExpireStaleApplications = true;
            }

            sessionControl.controls = this.normalizeControls(
                controlsData.controls,
            ).controls;
        }

        // Update payment controls if provided
        if (controlsData.payments) {
            sessionControl.payments = controlsData.payments.map((p) => ({
                paymentId: new Types.ObjectId(p.paymentId),
                active: p.active,
                eligibleStudentGroups: p.eligibleStudentGroups?.length
                    ? p.eligibleStudentGroups
                    : ['new', 'returning'],
            }));
        }

        sessionControl.updatedBy = new Types.ObjectId(updatedBy);
        await sessionControl.save();

        const expiredApplicants = shouldExpireStaleApplications
            ? await this.expireStaleApplicationsForSession(academicSessionId, updatedBy)
            : [];

        return { sessionControl, expiredApplicants };
    }

    async expireStaleApplicationsForSession(
        academicSessionId: string,
        updatedBy?: string,
    ): Promise<Array<{ email: string; firstName: string }>> {
        // Expire all pending applications where no admission decision has been made yet.
        // This covers stages 1–5: applicants who have not been admitted (admissionDecision still AWAITING_DECISION).
        // Stage 6 (screening) is intentionally excluded — admissionDecision is already GRANTED there.
        const affected = await this.applicationModel
            .find({
                entryAcademicSession: new Types.ObjectId(academicSessionId),
                status: ApplicationStatus.PENDING,
                admissionDecision: AdmissionDecision.AWAITING_DECISION,
            })
            .populate('userId', 'email firstName')
            .exec();

        if (affected.length === 0) {
            return [];
        }

        const ids = affected.map((a) => (a as any)._id);
        const auditEntry = {
            action: 'application_expired',
            description:
                'Application expired automatically: the application window was closed and no admission decision had been made.',

            performedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
            actorRole: 'system',
            createdAt: new Date(),
        };

        await this.applicationModel.updateMany(
            { _id: { $in: ids } },
            {
                $set: { status: ApplicationStatus.EXPIRED },
                $push: { auditTrail: auditEntry } as any,
            },
        );

        return affected
            .map((a) => {
                const user = (a as any).userId;
                return {
                    email: user?.email || '',
                    firstName: user?.firstName || '',
                };
            })
            .filter((u) => Boolean(u.email));
    }

    async toggleControl(
        academicSessionId: string,
        controlName: string,
        active: boolean,
        updatedBy: string,
    ): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!sessionControl) {
            throw new NotFoundException("Session controls not found");
        }

        await this.ensureDefaultControls(sessionControl);

        // Find and update the specific control
        const controlIndex = sessionControl.controls.findIndex(
            (c) => c.name === controlName,
        );

        if (controlIndex === -1) {
            throw new NotFoundException(`Control '${controlName}' not found`);
        }

        sessionControl.controls[controlIndex].active = active;
        sessionControl.updatedBy = new Types.ObjectId(updatedBy);

        return sessionControl.save();
    }

    async togglePaymentControl(
        academicSessionId: string,
        paymentId: string,
        active: boolean,
        updatedBy: string,
    ): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!sessionControl) {
            throw new NotFoundException("Session controls not found");
        }

        // Find and update the specific payment control
        const paymentIndex = sessionControl.payments.findIndex(
            (p) => p.paymentId.toString() === paymentId,
        );

        if (paymentIndex === -1) {
            // Add new payment control if it doesn't exist
            sessionControl.payments.push({
                paymentId: new Types.ObjectId(paymentId),
                active,
            });
        } else {
            sessionControl.payments[paymentIndex].active = active;
        }

        sessionControl.updatedBy = new Types.ObjectId(updatedBy);

        return sessionControl.save();
    }

    async getActiveControls(academicSessionId: string): Promise<{
        controls: string[];
        payments: string[];
    }> {
        const sessionControl = await this.sessionControlModel
            .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) })
            .populate("payments.paymentId")
            .exec();

        if (!sessionControl) {
            return { controls: [], payments: [] };
        }

        await this.ensureDefaultControls(sessionControl);

        const activeControls = sessionControl.controls
            .filter((c) => c.active)
            .map((c) => c.name);

        const activePayments = sessionControl.payments
            .filter((p) => p.active)
            .map((p) => p.paymentId.toString());

        return {
            controls: activeControls,
            payments: activePayments,
        };
    }

    async getAdmissionFlowConfig(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string,
        application?: AdmissionFlowApplicationContext,
    ): Promise<AdmissionFlowConfig> {
        const sessionId = this.extractSessionId(academicSessionId);
        const jambExemptExamOverride =
            this.shouldAllowJambExemptEntranceExam(application);

        if (!sessionId) {
            return {
                entranceExamEnabled: true,
                screeningEnabled: true,
            };
        }

        const sessionControl = await this.sessionControlModel
            .findOne({ academicSessionId: new Types.ObjectId(sessionId) })
            .exec();

        if (!sessionControl) {
            return {
                entranceExamEnabled: true,
                screeningEnabled: true,
            };
        }

        const normalizedSessionControl =
            await this.ensureDefaultControls(sessionControl);

        const entranceExamControlEnabled =
            normalizedSessionControl.controls.find(
                (control) => control.name === "entranceExam",
            )?.active ?? true;

        return {
            entranceExamEnabled:
                entranceExamControlEnabled || jambExemptExamOverride,
            screeningEnabled:
                normalizedSessionControl.controls.find(
                    (control) => control.name === "screening",
                )?.active ?? true,
        };
    }

    async getNextStageAfterApplicationForm(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string,
        application?: AdmissionFlowApplicationContext,
    ): Promise<number> {
        const flowConfig = await this.getAdmissionFlowConfig(
            academicSessionId,
            application,
        );

        if (flowConfig.entranceExamEnabled) {
            return 4;
        }

        return 5;
    }

    async getNextStageAfterExam(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string,
        application?: AdmissionFlowApplicationContext,
    ): Promise<number> {
        await this.getAdmissionFlowConfig(academicSessionId, application);
        return 5;
    }

    async syncApplicationStageWithControls(
        application: ApplicationStageCarrier,
    ): Promise<{
        currentStage: number;
        admissionFlow: AdmissionFlowConfig;
        wasUpdated: boolean;
    }> {
        const admissionFlow = await this.getAdmissionFlowConfig(
            application.entryAcademicSession,
            application,
        );
        let currentStage = application.currentStage;

        if (currentStage === 4 && !admissionFlow.entranceExamEnabled) {
            currentStage = 5;
        }

        if (currentStage === 6 && !admissionFlow.screeningEnabled) {
            currentStage = 7;
        }

        const wasUpdated = currentStage > application.currentStage;

        if (wasUpdated) {
            application.currentStage = currentStage;
            application.markModified?.("currentStage");

            if (typeof application.save === "function") {
                await application.save();
            }
        }

        return {
            currentStage,
            admissionFlow,
            wasUpdated,
        };
    }
}

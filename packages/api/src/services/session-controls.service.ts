import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
    AccommodationControl,
    SessionControl,
    SessionControlDocument,
} from "../schemas/session-control.schema";
import { Payment, PaymentDocument } from "../schemas/payment.schema";

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

        const accommodation = sessionControl.accommodation || {
            internalApplicationsOpen: false,
            externalApplicationsOpen: false,
            categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
        };
        const accommodationChanged = !sessionControl.accommodation;

        if (changed || paymentsChanged || accommodationChanged) {
            sessionControl.controls = controls;
            sessionControl.payments = normalizedPayments;
            sessionControl.accommodation = accommodation as AccommodationControl;
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

    async isControlEnabled(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string
            | undefined,
        controlName: string,
    ): Promise<boolean> {
        const sessionId = this.extractSessionId(academicSessionId);
        if (!sessionId || !Types.ObjectId.isValid(sessionId)) return false;

        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(sessionId),
        });
        if (!sessionControl) return false;

        await this.ensureDefaultControls(sessionControl);
        return sessionControl.controls.some(
            (control) => control.name === controlName && control.active === true,
        );
    }

    async assertApplicationIntakeOpen(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string
            | undefined,
    ): Promise<void> {
        if (!(await this.isControlEnabled(academicSessionId, "application"))) {
            throw new ConflictException(
                "Applications for this academic session are currently closed",
            );
        }
    }

    async assertAdmissionProcessingEnabled(
        academicSessionId:
            | Types.ObjectId
            | { _id?: Types.ObjectId | string }
            | string
            | undefined,
    ): Promise<void> {
        if (!(await this.isControlEnabled(academicSessionId, "admissionProcessing"))) {
            throw new ConflictException(
                "Admission processing is currently paused for this academic session",
            );
        }
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
            accommodation: {
                internalApplicationsOpen: false,
                externalApplicationsOpen: false,
                categories: [{ code: 'pre_degree', label: 'Pre-degree', active: true, isDefault: true }],
            },
            updatedBy: new Types.ObjectId(updatedBy),
        });

        return sessionControl.save();
    }

    async findBySessionId(academicSessionId: string): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel
            .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) })
            .populate("payments.paymentId", "name description amount paymentCode targetAudience active")
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
            accommodation?: {
                internalApplicationsOpen: boolean;
                externalApplicationsOpen: boolean;
                internalPaymentId?: string;
                externalPaymentId?: string;
                applicationOpenAt?: string;
                applicationCloseAt?: string;
                categories?: Array<{ code: string; label: string; active: boolean; isDefault: boolean }>;
            };
        },
        updatedBy: string,
    ): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!sessionControl) {
            throw new NotFoundException("Session controls not found");
        }

        await this.ensureDefaultControls(sessionControl);

        if (controlsData.controls) {
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

        if (controlsData.accommodation) {
            const value = controlsData.accommodation;
            const normalizeOptionalPaymentId = (paymentId?: string) => {
                const normalized = typeof paymentId === 'string' ? paymentId.trim() : '';
                if (!normalized || normalized === 'undefined' || normalized === 'null') return undefined;
                if (!Types.ObjectId.isValid(normalized)) {
                    throw new ConflictException('Select a valid accommodation payment');
                }
                return normalized;
            };
            const internalPaymentId = normalizeOptionalPaymentId(value.internalPaymentId);
            const externalPaymentId = normalizeOptionalPaymentId(value.externalPaymentId);
            const categories = (value.categories || []).filter((category) => category.active);
            if (!categories.length) {
                throw new ConflictException('At least one active accommodation category is required');
            }
            if (categories.filter((category) => category.isDefault).length !== 1) {
                throw new ConflictException('Exactly one active accommodation category must be the default');
            }
            const openAt = value.applicationOpenAt ? new Date(value.applicationOpenAt) : undefined;
            const closeAt = value.applicationCloseAt ? new Date(value.applicationCloseAt) : undefined;
            if (openAt && closeAt && openAt >= closeAt) {
                throw new ConflictException('Accommodation closing date must be later than its opening date');
            }
            if (value.internalApplicationsOpen && !internalPaymentId) {
                throw new ConflictException('Select an internal accommodation payment before opening internal applications');
            }
            if (value.externalApplicationsOpen && !externalPaymentId) {
                throw new ConflictException('Select an external accommodation payment before opening external applications');
            }
            const selectedPaymentIds = [internalPaymentId, externalPaymentId].filter(Boolean) as string[];
            const selectedPayments = selectedPaymentIds.length
                ? await this.paymentModel.find({ _id: { $in: selectedPaymentIds }, active: true }).select('_id targetAudience').lean()
                : [];
            const paymentMap = new Map(selectedPayments.map((payment) => [payment._id.toString(), payment]));
            if (internalPaymentId && !paymentMap.get(internalPaymentId)?.targetAudience?.includes('student' as any)) {
                throw new ConflictException('Internal accommodation payment must be active and available to students');
            }
            if (externalPaymentId && !paymentMap.get(externalPaymentId)?.targetAudience?.includes('external_resident' as any)) {
                throw new ConflictException('External accommodation payment must be active and available to external residents');
            }
            sessionControl.accommodation = {
                internalApplicationsOpen: Boolean(value.internalApplicationsOpen),
                externalApplicationsOpen: Boolean(value.externalApplicationsOpen),
                internalPaymentId: internalPaymentId ? new Types.ObjectId(internalPaymentId) : undefined,
                externalPaymentId: externalPaymentId ? new Types.ObjectId(externalPaymentId) : undefined,
                applicationOpenAt: openAt,
                applicationCloseAt: closeAt,
                categories: value.categories || [],
            };
        }

        sessionControl.updatedBy = new Types.ObjectId(updatedBy);
        await sessionControl.save();
        return sessionControl;
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

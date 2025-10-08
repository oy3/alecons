import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SessionControl, SessionControlDocument } from '../schemas/session-control.schema';
import { Payment, PaymentDocument } from '../schemas/payment.schema';

@Injectable()
export class SessionControlsService {
    constructor(
        @InjectModel(SessionControl.name)
        private sessionControlModel: Model<SessionControlDocument>,
        @InjectModel(Payment.name)
        private paymentModel: Model<PaymentDocument>,
    ) { }

    async createDefaultControls(
        academicSessionId: Types.ObjectId,
        updatedBy: string,
    ): Promise<SessionControl> {
        // Get all available payments
        const payments = await this.paymentModel.find({ active: true });

        // Create payment controls for all active payments
        const paymentControls = payments.map(payment => ({
            paymentId: payment._id,
            active: false,
        }));

        const sessionControl = new this.sessionControlModel({
            academicSessionId,
            controls: [
                { name: 'application', active: false },
                { name: 'admissionProcessing', active: false },
                { name: 'courseRegistration', active: false },
                { name: 'resultUpload', active: false },
                { name: 'resultRelease', active: false },
            ],
            payments: paymentControls,
            updatedBy: new Types.ObjectId(updatedBy),
        });

        return sessionControl.save();
    }

    async findBySessionId(academicSessionId: string): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel
            .findOne({ academicSessionId: new Types.ObjectId(academicSessionId) })
            .populate('payments.paymentId', 'name description amount paymentCode')
            .exec();

        if (!sessionControl) {
            throw new NotFoundException('Session controls not found');
        }

        return sessionControl;
    }

    async updateControls(
        academicSessionId: string,
        controlsData: {
            controls?: Array<{ name: string; active: boolean }>;
            payments?: Array<{ paymentId: string; active: boolean }>;
        },
        updatedBy: string,
    ): Promise<SessionControl> {
        const sessionControl = await this.sessionControlModel.findOne({
            academicSessionId: new Types.ObjectId(academicSessionId),
        });

        if (!sessionControl) {
            throw new NotFoundException('Session controls not found');
        }

        // Update controls if provided
        if (controlsData.controls) {
            sessionControl.controls = controlsData.controls;
        }

        // Update payment controls if provided
        if (controlsData.payments) {
            sessionControl.payments = controlsData.payments.map(p => ({
                paymentId: new Types.ObjectId(p.paymentId),
                active: p.active,
            }));
        }

        sessionControl.updatedBy = new Types.ObjectId(updatedBy);

        return sessionControl.save();
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
            throw new NotFoundException('Session controls not found');
        }

        // Find and update the specific control
        const controlIndex = sessionControl.controls.findIndex(
            c => c.name === controlName,
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
            throw new NotFoundException('Session controls not found');
        }

        // Find and update the specific payment control
        const paymentIndex = sessionControl.payments.findIndex(
            p => p.paymentId.toString() === paymentId,
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
            .populate('payments.paymentId')
            .exec();

        if (!sessionControl) {
            return { controls: [], payments: [] };
        }

        const activeControls = sessionControl.controls
            .filter(c => c.active)
            .map(c => c.name);

        const activePayments = sessionControl.payments
            .filter(p => p.active)
            .map(p => p.paymentId.toString());

        return {
            controls: activeControls,
            payments: activePayments,
        };
    }
}
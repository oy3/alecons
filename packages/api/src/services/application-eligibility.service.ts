import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicSession, AcademicSessionDocument, SessionStatus } from '../schemas/academic-session.schema';
import { SessionControl, SessionControlDocument } from '../schemas/session-control.schema';

export interface EligibilityResult {
    eligible: boolean;
    reason?: string;
    activeSession?: AcademicSession;
}

@Injectable()
export class ApplicationEligibilityService {
    private readonly logger = new Logger(ApplicationEligibilityService.name);

    constructor(
        @InjectModel(AcademicSession.name) private sessionModel: Model<AcademicSessionDocument>,
        @InjectModel(SessionControl.name) private sessionControlModel: Model<SessionControlDocument>,
    ) { }

    private async findOpenApplicationSession(): Promise<AcademicSessionDocument | null> {
        return this.sessionModel
            .findOne({ status: SessionStatus.OPEN })
            .sort({ active: -1, startDate: -1, createdAt: -1 });
    }

    private async findCurrentReferenceSession(): Promise<AcademicSessionDocument | null> {
        const activeSession = await this.sessionModel
            .findOne({ active: true })
            .sort({ startDate: -1, createdAt: -1 });

        if (activeSession) {
            return activeSession;
        }

        return this.sessionModel
            .findOne({})
            .sort({ active: -1, startDate: -1, createdAt: -1 });
    }

    private buildNotOpenReason(session: AcademicSessionDocument | null): string {
        if (!session) {
            return 'Applications are temporarily disabled. Please check back later.';
        }

        if (session.status === SessionStatus.CLOSED) {
            return `Registration for ${session.sessionYear} academic session is currently closed.`;
        }

        if (session.status === SessionStatus.ONGOING) {
            return 'Registration for new academic session is not open. Please check back later.';
        }

        if (session.status === SessionStatus.DRAFT) {
            return 'Registration for new academic session is not open. Please check back later.';
        }

        return 'Applications are temporarily disabled. Please check back later.';
    }

    /**
     * Check if a user is eligible to register for applications
     */
    async checkRegistrationEligibility(): Promise<EligibilityResult> {
        try {
            const openSession = await this.findOpenApplicationSession();

            if (!openSession) {
                const currentSession = await this.findCurrentReferenceSession();

                this.logger.log('No open academic session found for registration', {
                    currentSessionId: currentSession?._id,
                    currentSessionYear: currentSession?.sessionYear,
                    currentSessionStatus: currentSession?.status,
                });

                return {
                    eligible: false,
                    reason: this.buildNotOpenReason(currentSession)
                };
            }

            this.logger.log('Found open academic session for registration:', {
                sessionId: openSession._id,
                sessionYear: openSession.sessionYear,
                status: openSession.status,
                active: openSession.active,
            });

            // Check session controls (this is the primary check for applications)
            const sessionControls = await this.sessionControlModel.findOne({
                academicSessionId: openSession._id
            });

            if (!sessionControls) {
                this.logger.log('No session controls found for open registration session');
                return {
                    eligible: false,
                    reason: `Applications for ${openSession.sessionYear} are temporarily disabled. Please check back later.`,
                    activeSession: openSession,
                };
            }

            // Check if application control is active
            const applicationControl = sessionControls.controls.find(
                control => control.name === 'application' && control.active === true
            );

            if (!applicationControl) {
                this.logger.log('Application control is not active');
                return {
                    eligible: false,
                    reason: `Applications for ${openSession.sessionYear} are temporarily disabled. Please check back later.`,
                    activeSession: openSession,
                };
            }

            this.logger.log('Registration eligibility check passed', {
                sessionId: openSession._id,
                sessionYear: openSession.sessionYear,
            });

            return {
                eligible: true,
                activeSession: openSession,
            };

        } catch (error) {
            this.logger.error('Error checking registration eligibility:', error);
            return {
                eligible: false,
                reason: 'Unable to verify registration eligibility. Please try again later.'
            };
        }
    }

    /**
     * Get the currently active application session
     */
    async getActiveApplicationSession(): Promise<AcademicSession | null> {
        try {
            const openSession = await this.findOpenApplicationSession();

            if (!openSession) {
                return null;
            }

            // Check if application control is active
            const sessionControls = await this.sessionControlModel.findOne({
                academicSessionId: openSession._id
            });

            if (!sessionControls) {
                return null;
            }

            const applicationControl = sessionControls.controls.find(
                control => control.name === 'application' && control.active === true
            );

            return applicationControl ? openSession : null;
        } catch (error) {
            this.logger.error('Error getting active application session:', error);
            return null;
        }
    }
}
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

    /**
     * Check if a user is eligible to register for applications
     */
    async checkRegistrationEligibility(): Promise<EligibilityResult> {
        try {
            // Find the active session (applications controlled via session controls)
            const activeSession = await this.sessionModel.findOne({
                active: true,
                status: { $in: [SessionStatus.OPEN, SessionStatus.ONGOING] }
            });

            if (!activeSession) {
                this.logger.log('No active session found');
                return {
                    eligible: false,
                    reason: 'No active academic session available. Please contact administration.'
                };
            }

            this.logger.log('Found active session:', {
                sessionId: activeSession._id,
                sessionYear: activeSession.sessionYear,
                status: activeSession.status
            });

            // Check session controls (this is the primary check for applications)
            const sessionControls = await this.sessionControlModel.findOne({
                academicSessionId: activeSession._id
            });

            if (!sessionControls) {
                this.logger.log('No session controls found for active session');
                return {
                    eligible: false,
                    reason: 'Application controls not configured for current session.'
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
                    reason: 'Applications are temporarily disabled. Please check back later.'
                };
            }

            this.logger.log('Registration eligibility check passed', {
                sessionId: activeSession._id,
                sessionYear: activeSession.sessionYear
            });

            return {
                eligible: true,
                activeSession
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
            // Find active session and check if applications are enabled via controls
            const activeSession = await this.sessionModel.findOne({
                active: true,
                status: { $in: [SessionStatus.OPEN, SessionStatus.ONGOING] }
            });

            if (!activeSession) {
                return null;
            }

            // Check if application control is active
            const sessionControls = await this.sessionControlModel.findOne({
                academicSessionId: activeSession._id
            });

            if (!sessionControls) {
                return null;
            }

            const applicationControl = sessionControls.controls.find(
                control => control.name === 'application' && control.active === true
            );

            return applicationControl ? activeSession : null;
        } catch (error) {
            this.logger.error('Error getting active application session:', error);
            return null;
        }
    }
}
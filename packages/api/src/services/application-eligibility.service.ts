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
            // Find the active session with applications open
            const activeSession = await this.sessionModel.findOne({
                active: true,
                applicationsOpen: true,
                status: { $in: [SessionStatus.OPEN, SessionStatus.ONGOING] }
            });

            if (!activeSession) {
                this.logger.log('No active session with applications open found');
                return {
                    eligible: false,
                    reason: 'No active application session available. Applications are currently closed.'
                };
            }

            // Check session controls
            const sessionControls = await this.sessionControlModel.findOne({
                academicSessionId: activeSession._id,
                isActive: true
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
            return await this.sessionModel.findOne({
                active: true,
                applicationsOpen: true,
                status: { $in: [SessionStatus.OPEN, SessionStatus.ONGOING] }
            });
        } catch (error) {
            this.logger.error('Error getting active application session:', error);
            return null;
        }
    }

    /**
     * Validate that only one session can have applicationsOpen = true
     */
    async validateSingleOpenSession(sessionId: string): Promise<boolean> {
        try {
            const openSessions = await this.sessionModel.find({
                applicationsOpen: true,
                _id: { $ne: sessionId }
            });

            return openSessions.length === 0;
        } catch (error) {
            this.logger.error('Error validating single open session:', error);
            return false;
        }
    }

    /**
     * Close applications for a session and update status
     */
    async closeApplicationsForSession(sessionId: string): Promise<void> {
        try {
            await this.sessionModel.findByIdAndUpdate(sessionId, {
                applicationsOpen: false,
                status: SessionStatus.ONGOING
            });

            this.logger.log('Applications closed for session:', sessionId);
        } catch (error) {
            this.logger.error('Error closing applications for session:', error);
            throw error;
        }
    }

    /**
     * Open applications for a session (ensuring only one is open at a time)
     */
    async openApplicationsForSession(sessionId: string): Promise<void> {
        try {
            // First close applications for all other sessions
            await this.sessionModel.updateMany(
                { _id: { $ne: sessionId } },
                { applicationsOpen: false }
            );

            // Then open applications for the specified session
            await this.sessionModel.findByIdAndUpdate(sessionId, {
                applicationsOpen: true,
                active: true,
                status: SessionStatus.OPEN
            });

            this.logger.log('Applications opened for session:', sessionId);
        } catch (error) {
            this.logger.error('Error opening applications for session:', error);
            throw error;
        }
    }
}
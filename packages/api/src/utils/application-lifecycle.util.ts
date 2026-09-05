import {
    AdmissionDecision,
    ApplicationStatus,
} from '../schemas/application.schema';

type ApplicationLifecycleRecord = {
    status?: ApplicationStatus | string;
    admissionDecision?: AdmissionDecision | string;
    matriculationNumber?: string | null;
    submittedAt?: Date | string | null;
    auditTrail?: Array<{ action?: string }>;
    profileImageUrl?: string | null;
    documents?: {
        profilePicture?: { url?: string | null };
        olevelResults?: unknown[];
        referenceLetters?: unknown[];
    };
    examinations?: unknown[];
    referees?: unknown[];
    academicBackground?: {
        primary?: unknown;
        secondary?: unknown;
    };
};

const CLOSED_APPLICATION_STATUSES = new Set<string>([
    ApplicationStatus.COMPLETED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.EXPIRED,
]);

export function isUnfinishedApplication(application: ApplicationLifecycleRecord): boolean {
    return Boolean(
        application &&
        !CLOSED_APPLICATION_STATUSES.has(String(application.status || '')) &&
        !application.matriculationNumber,
    );
}

export function canRevokeAdmissionDecision(application: ApplicationLifecycleRecord): boolean {
    return Boolean(
        isUnfinishedApplication(application) &&
        application.admissionDecision === AdmissionDecision.GRANTED,
    );
}

export function hasSubmittedApplication(application: ApplicationLifecycleRecord): boolean {
    if (application.submittedAt) return true;

    if (
        Array.isArray(application.auditTrail) &&
        application.auditTrail.some((entry) => entry?.action === 'application_submitted')
    ) {
        return true;
    }

    const hasProfile = Boolean(
        application.profileImageUrl || application.documents?.profilePicture?.url,
    );

    return Boolean(
        hasProfile &&
        application.academicBackground?.primary &&
        application.academicBackground?.secondary &&
        application.documents?.olevelResults?.length &&
        application.documents?.referenceLetters?.length &&
        application.examinations?.length &&
        application.referees?.length,
    );
}

export function getScheduledLagosDateTime(
    date: Date | string | undefined,
    time: string | undefined,
): Date | null {
    if (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;

    const normalizedDate = new Date(date);
    if (Number.isNaN(normalizedDate.getTime())) return null;

    const day = normalizedDate.toISOString().slice(0, 10);
    const scheduledAt = new Date(`${day}T${time}:00+01:00`);
    return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
}

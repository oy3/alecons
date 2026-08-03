import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../schemas/user.schema';

export type CourseRegistrationPermission = 'view' | 'approve' | 'reject';

export interface CourseRegistrationModuleAccess {
    roleName: string;
    permissions: string[];
}

export interface StaffCourseRegistrationAccess {
    scope: 'institution' | 'advisor';
    actorRole: string;
    permissions: Set<string>;
}

export function resolveCourseRegistrationAccess(
    userRole: UserRole,
    moduleAccess: CourseRegistrationModuleAccess | null,
    requiredPermission: CourseRegistrationPermission,
): StaffCourseRegistrationAccess {
    if (userRole === UserRole.ADMIN) {
        return {
            scope: 'institution',
            actorRole: 'Administrator',
            permissions: new Set(['manage']),
        };
    }

    const permissions = new Set(moduleAccess?.permissions || []);
    const canManageAll = permissions.has('manage');
    if (!canManageAll && !permissions.has(requiredPermission)) {
        throw new ForbiddenException(`You do not have permission to ${requiredPermission} course registrations`);
    }

    return {
        scope: canManageAll ? 'institution' : 'advisor',
        actorRole: moduleAccess?.roleName || 'Staff',
        permissions,
    };
}

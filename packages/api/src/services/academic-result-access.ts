export function hasAcademicResultPermission(
    role: { modules?: Array<{ module?: string; permissions?: string[] }> } | null | undefined,
    permission: string,
    isAdmin = false,
): boolean {
    if (isAdmin) return true;
    const resultModule = role?.modules?.find((item) => item.module === 'academicResults');
    return Boolean(
        resultModule?.permissions?.includes(permission) ||
        resultModule?.permissions?.includes('manage'),
    );
}

export function isAssignedAcademicOwner(userId: string, assignedUserIds: unknown[] = []): boolean {
    return assignedUserIds.some((value: any) => String(value?._id || value || '') === String(userId));
}

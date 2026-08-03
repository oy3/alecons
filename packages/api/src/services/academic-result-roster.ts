function entityId(value: any): string {
    return String(value?._id || value || '');
}

export function filterStudentsWithCurrentCourseRegistration(
    students: any[],
    registrations: any[],
): any[] {
    const registeredContexts = new Set(
        registrations.map((registration) => (
            `${entityId(registration.studentId)}:${entityId(registration.academicSessionId)}`
        )),
    );

    return students.filter((student) => {
        const sessionId = entityId(student.academicSession);
        return registeredContexts.has(`${entityId(student)}:${sessionId}`);
    });
}

/**
 * Canonical module and per-module permission definitions for the staff portal.
 *
 * Each module declares only the permissions that are meaningful for that domain.
 * This prevents nonsensical combinations (e.g. "Approve" on Reports).
 *
 * The `manage` permission acts as a master toggle — when selected it implies
 * full control of the module and auto-checks all other permissions in the UI.
 */
export const MODULE_DEFINITIONS = {
    applications: {
        label: 'Applications',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'create', label: 'Create' },
            { value: 'edit', label: 'Edit' },
            { value: 'delete', label: 'Delete' },
            { value: 'approve', label: 'Approve' },
            { value: 'export', label: 'Export' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    admissions: {
        label: 'Admissions',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'approve', label: 'Approve' },
            { value: 'export', label: 'Export' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    academics: {
        label: 'Academics',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'create', label: 'Create' },
            { value: 'edit', label: 'Edit' },
            { value: 'delete', label: 'Delete' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    courseRegistrations: {
        label: 'Course Registrations',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'review', label: 'Review' },
            { value: 'approve', label: 'Approve' },
            { value: 'reject', label: 'Reject' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    academicResults: {
        label: 'Result Grading',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'configure', label: 'Configure Grade Scales' },
            { value: 'enter_scores', label: 'Enter Scores' },
            { value: 'submit', label: 'Submit for Review' },
            { value: 'review_hod', label: 'HOD Review' },
            { value: 'review_provost', label: 'Provost Review' },
            { value: 'publish', label: 'Publish Results' },
            { value: 'amend', label: 'Amend Published Results' },
            { value: 'export', label: 'Export' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    exams: {
        label: 'Exams',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'create', label: 'Create' },
            { value: 'edit', label: 'Edit' },
            { value: 'delete', label: 'Delete' },
            { value: 'publish', label: 'Publish' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    payments: {
        label: 'Payments',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'edit', label: 'Edit' },
            { value: 'export', label: 'Export' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    users: {
        label: 'Users',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'create', label: 'Create' },
            { value: 'edit', label: 'Edit' },
            { value: 'delete', label: 'Delete' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    students: {
        label: 'Students',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'edit', label: 'Edit Status' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    utilities: {
        label: 'Utilities',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    reports: {
        label: 'Reports',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'export', label: 'Export' },
        ],
    },
    settings: {
        label: 'Settings',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
    idCards: {
        label: 'ID Cards',
        permissions: [
            { value: 'view', label: 'View' },
            { value: 'generate', label: 'Generate' },
            { value: 'export', label: 'Export' },
            { value: 'manage', label: 'Manage All' },
        ],
    },
}

/**
 * Flat array of module entries — convenient for iterating in templates and modals.
 */
export const MODULE_LIST = Object.entries(MODULE_DEFINITIONS).map(([value, def]) => ({
    value,
    label: def.label,
    permissions: def.permissions,
}))

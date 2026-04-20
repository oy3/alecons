export const staffNavigationItems = [
    {
        title: 'Dashboard',
        icon: 'bi-house-door',
        route: '/dashboard',
        permissions: ['view', 'dashboard:view']
    },
    {
        title: 'Applications',
        icon: 'bi-file-earmark-text',
        route: '/applications',
        permissions: ['view', 'applications:view']
    },
    {
        title: 'Admission',
        icon: 'bi-clipboard-check',
        route: '/admission',
        permissions: ['staff', 'admin', 'applications:manage']
    },
    {
        title: 'Academics',
        icon: 'bi-mortarboard',
        route: '/academics',
        permissions: ['staff', 'admin', 'academics:manage']
    },
    {
        title: 'Exams',
        icon: 'bi-file-text',
        route: '/exams',
        permissions: ['staff', 'admin', 'exams:manage']
    },
    {
        title: 'Users',
        icon: 'bi-people',
        route: '/users',
        permissions: ['view', 'users:view']
    },
    {
        title: 'Payments',
        icon: 'bi-credit-card-2-front',
        route: '/payments',
        permissions: ['view', 'read', 'payments:view', 'payments:read']
    },
    {
        title: 'Utilities',
        icon: 'bi-tools',
        route: '/utilities',
        permissions: ['view', 'settings:view']
    },
    {
        title: 'Reports',
        icon: 'bi-graph-up',
        route: '/reports',
        permissions: ['view', 'reports:view']
    },
    {
        title: 'Settings',
        icon: 'bi-gear',
        route: '/settings',
        permissions: ['view', 'settings:view']
    }
]

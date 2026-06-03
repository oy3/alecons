import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';

@Injectable()
export class RoleSeederService implements OnModuleInit {
    private readonly logger = new Logger(RoleSeederService.name);

    constructor(
        @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    ) { }

    async onModuleInit() {
        await this.seedDefaultRoles();
    }

    private async seedDefaultRoles() {
        try {
            const existingRoles = await this.roleModel.countDocuments();
            if (existingRoles > 0) {
                this.logger.log('Roles already exist, skipping seeding');
                return;
            }

            const defaultRoles = [
                {
                    name: 'Super Administrator',
                    description: 'Full system access with all permissions',
                    modules: [
                        {
                            module: 'users',
                            permissions: ['view', 'create', 'read', 'update', 'delete', 'manage']
                        },
                        {
                            module: 'applications',
                            permissions: ['view', 'create', 'read', 'update', 'delete', 'approve', 'export', 'manage']
                        },
                        {
                            module: 'courseRegistrations',
                            permissions: ['view', 'review', 'approve', 'reject', 'manage']
                        },
                        {
                            module: 'exams',
                            permissions: ['view', 'create', 'edit', 'delete', 'publish', 'manage']
                        },
                        {
                            module: 'reports',
                            permissions: ['view', 'export']
                        },
                        {
                            module: 'settings',
                            permissions: ['view', 'manage']
                        }
                    ],
                    active: true
                },
                {
                    name: 'Admissions Manager',
                    description: 'Manage applications and admissions process',
                    modules: [
                        {
                            module: 'applications',
                            permissions: ['view', 'create', 'read', 'edit', 'approve', 'export']
                        },
                        {
                            module: 'courseRegistrations',
                            permissions: ['view', 'review', 'approve', 'reject']
                        },
                        {
                            module: 'reports',
                            permissions: ['view', 'export']
                        }
                    ],
                    active: true
                },
                {
                    name: 'Academic Staff',
                    description: 'Manage academic content and exams',
                    modules: [
                        {
                            module: 'exams',
                            permissions: ['view', 'create', 'edit', 'publish']
                        },
                        {
                            module: 'applications',
                            permissions: ['view', 'read']
                        },
                        {
                            module: 'courseRegistrations',
                            permissions: ['view']
                        },
                        {
                            module: 'reports',
                            permissions: ['view']
                        }
                    ],
                    active: true
                },
                {
                    name: 'Administrative Staff',
                    description: 'General administrative functions',
                    modules: [
                        {
                            module: 'applications',
                            permissions: ['view', 'read', 'edit']
                        },
                        {
                            module: 'courseRegistrations',
                            permissions: ['view']
                        },
                        {
                            module: 'reports',
                            permissions: ['view']
                        }
                    ],
                    active: true
                },
                {
                    name: 'Examinations Officer',
                    description: 'Manage examinations and results',
                    modules: [
                        {
                            module: 'exams',
                            permissions: ['create', 'read', 'update', 'schedule', 'grade', 'publish']
                        },
                        {
                            module: 'applications',
                            permissions: ['view', 'read', 'edit']
                        },
                        {
                            module: 'reports',
                            permissions: ['view', 'export']
                        }
                    ],
                    active: true
                },
                {
                    name: 'IT Support',
                    description: 'Technical support and system maintenance',
                    modules: [
                        {
                            module: 'users',
                            permissions: ['view', 'edit']
                        },
                        {
                            module: 'settings',
                            permissions: ['view', 'manage']
                        },
                        {
                            module: 'reports',
                            permissions: ['view']
                        }
                    ],
                    active: true
                }
            ];

            await this.roleModel.insertMany(defaultRoles);
            this.logger.log(`Successfully seeded ${defaultRoles.length} default roles`);

        } catch (error) {
            this.logger.error('Failed to seed default roles:', error);
        }
    }
}
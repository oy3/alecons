import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { User, UserRole } from '../schemas/user.schema';
import { Staff } from '../schemas/staff.schema';
import { Role } from '../schemas/role.schema';
import { Logger } from '@nestjs/common';

async function seedStaffData() {
    const logger = new Logger('StaffSeeder');

    try {
        const app = await NestFactory.createApplicationContext(AppModule);

        const userModel = app.get<Model<User>>(getModelToken(User.name));
        const staffModel = app.get<Model<Staff>>(getModelToken(Staff.name));
        const roleModel = app.get<Model<Role>>(getModelToken(Role.name));

        // First, create roles with permissions
        const adminRole = await roleModel.findOneAndUpdate(
            { name: 'Administrator' },
            {
                name: 'Administrator',
                description: 'Full system administrator with all permissions',
                modules: [
                    {
                        module: 'dashboard',
                        permissions: ['view', 'manage']
                    },
                    {
                        module: 'users',
                        permissions: ['view', 'create', 'edit', 'delete', 'manage']
                    },
                    {
                        module: 'courseRegistrations',
                        permissions: ['view', 'review', 'approve', 'reject', 'manage']
                    },
                    {
                        module: 'applications',
                        permissions: ['view', 'review', 'approve', 'reject', 'manage']
                    },
                    {
                        module: 'settings',
                        permissions: ['view', 'manage']
                    },
                    {
                        module: 'system',
                        permissions: ['view', 'manage', 'configure']
                    },
                    {
                        module: 'reports',
                        permissions: ['view', 'generate', 'export']
                    }
                ],
                active: true
            },
            { upsert: true, new: true }
        );

        const managerRole = await roleModel.findOneAndUpdate(
            { name: 'Manager' },
            {
                name: 'Manager',
                description: 'Department manager with limited administrative access',
                modules: [
                    {
                        module: 'dashboard',
                        permissions: ['view']
                    },
                    {
                        module: 'users',
                        permissions: ['view', 'edit']
                    },
                    {
                        module: 'applications',
                        permissions: ['view', 'review', 'approve', 'reject']
                    },
                    {
                        module: 'courseRegistrations',
                        permissions: ['view', 'review', 'approve', 'reject']
                    },
                    {
                        module: 'settings',
                        permissions: ['view']
                    },
                    {
                        module: 'reports',
                        permissions: ['view', 'generate']
                    }
                ],
                active: true
            },
            { upsert: true, new: true }
        );

        const staffRole = await roleModel.findOneAndUpdate(
            { name: 'Staff' },
            {
                name: 'Staff',
                description: 'Regular staff member with basic access',
                modules: [
                    {
                        module: 'dashboard',
                        permissions: ['view']
                    },
                    {
                        module: 'applications',
                        permissions: ['view', 'review']
                    },
                    {
                        module: 'courseRegistrations',
                        permissions: ['view']
                    },
                    {
                        module: 'settings',
                        permissions: ['view']
                    }
                ],
                active: true
            },
            { upsert: true, new: true }
        );

        logger.log('Roles created/updated successfully');

        // Create admin user - use passwordHash so the pre-save hook will hash it
        const adminEmail = 'admin@acons.edu';
        let adminUser = await userModel.findOne({ email: adminEmail });

        if (!adminUser) {
            adminUser = await userModel.create({
                email: adminEmail,
                passwordHash: 'admin123', // This will be hashed by the pre-save hook
                role: UserRole.ADMIN,
                firstName: 'System',
                lastName: 'Administrator',
                isActive: true,
                isEmailVerified: true
            });

            logger.log('Admin user created');
        } else {
            // Update password if user exists
            adminUser.passwordHash = 'admin123';
            await adminUser.save();
            logger.log('Admin user password updated');
        }

        // Create admin staff record
        let adminStaff = await staffModel.findOne({ userId: adminUser._id });
        if (!adminStaff) {
            adminStaff = await staffModel.create({
                userId: adminUser._id,
                staffId: 'ADM-001',
                department: 'Administration',
                position: 'System Administrator',
                roleId: adminRole._id,
                isActive: true
            });

            logger.log('Admin staff record created');
        } else {
            logger.log('Admin staff record already exists');
        }

        // Create manager user
        const managerEmail = 'manager@acons.edu';
        let managerUser = await userModel.findOne({ email: managerEmail });

        if (!managerUser) {
            managerUser = await userModel.create({
                email: managerEmail,
                passwordHash: 'manager123', // This will be hashed by the pre-save hook
                role: UserRole.STAFF,
                firstName: 'Sarah',
                lastName: 'Manager',
                isActive: true,
                isEmailVerified: true
            });

            logger.log('Manager user created');
        } else {
            // Update password if user exists
            managerUser.passwordHash = 'manager123';
            await managerUser.save();
            logger.log('Manager user password updated');
        }

        // Create manager staff record
        let managerStaff = await staffModel.findOne({ userId: managerUser._id });
        if (!managerStaff) {
            managerStaff = await staffModel.create({
                userId: managerUser._id,
                staffId: 'MGR-001',
                department: 'Admissions',
                position: 'Admissions Manager',
                roleId: managerRole._id,
                isActive: true
            });

            logger.log('Manager staff record created');
        } else {
            logger.log('Manager staff record already exists');
        }

        // Create regular staff user
        const staffEmail = 'staff@acons.edu';
        let staffUser = await userModel.findOne({ email: staffEmail });

        if (!staffUser) {
            staffUser = await userModel.create({
                email: staffEmail,
                passwordHash: 'staff123', // This will be hashed by the pre-save hook
                role: UserRole.STAFF,
                firstName: 'John',
                lastName: 'Staff',
                isActive: true,
                isEmailVerified: true
            });

            logger.log('Staff user created');
        } else {
            // Update password if user exists
            staffUser.passwordHash = 'staff123';
            await staffUser.save();
            logger.log('Staff user password updated');
        }

        // Create staff record
        let staffRecord = await staffModel.findOne({ userId: staffUser._id });
        if (!staffRecord) {
            staffRecord = await staffModel.create({
                userId: staffUser._id,
                staffId: 'STF-001',
                department: 'Academic Affairs',
                position: 'Academic Officer',
                roleId: staffRole._id,
                isActive: true
            });

            logger.log('Staff record created');
        } else {
            logger.log('Staff record already exists');
        }

        logger.log('✅ Staff data seeding completed successfully!');
        logger.log('📋 Test Accounts Created/Updated:');
        logger.log('🔑 Admin: admin@acons.edu / admin123');
        logger.log('🔑 Manager: manager@acons.edu / manager123');
        logger.log('🔑 Staff: staff@acons.edu / staff123');

        await app.close();

    } catch (error) {
        logger.error('❌ Staff data seeding failed:', error);
        process.exit(1);
    }
}

// Run the seeder
seedStaffData().then(() => {
    console.log('Seeding completed');
    process.exit(0);
}).catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
});
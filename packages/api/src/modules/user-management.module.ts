import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserManagementController } from '../controllers/user-management.controller';
import { RolesController } from '../controllers/roles.controller';
import { UserManagementService } from '../services/user-management.service';
import { RolesService } from '../services/roles.service';
import { RoleSeederService } from '../services/role-seeder.service';
import { User, UserSchema } from '../schemas/user.schema';
import { Staff, StaffSchema } from '../schemas/staff.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { EmailService } from '../services/email.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Staff.name, schema: StaffSchema },
            { name: Role.name, schema: RoleSchema }
        ])
    ],
    controllers: [UserManagementController, RolesController],
    providers: [UserManagementService, RolesService, RoleSeederService, EmailService],
    exports: [UserManagementService, RolesService]
})
export class UserManagementModule { }
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto';

@Injectable()
export class RolesService {
    private readonly logger = new Logger(RolesService.name);

    constructor(
        @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
        @InjectModel(Staff.name) private staffModel: Model<StaffDocument>
    ) { }

    async getAllRoles(): Promise<Role[]> {
        return this.roleModel
            .find({ active: true })
            .select('name description modules active createdAt')
            .sort({ createdAt: -1 })
            .lean();
    }

    async getRoleById(id: string): Promise<Role> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid role ID');
        }

        const role = await this.roleModel
            .findById(id)
            .select('name description modules active createdAt')
            .lean();

        if (!role) {
            throw new NotFoundException('Role not found');
        }

        return role;
    }

    async createRole(createRoleDto: CreateRoleDto): Promise<Role> {
        try {
            // Check if role name already exists
            const existingRole = await this.roleModel.findOne({
                name: createRoleDto.name,
                active: true
            });

            if (existingRole) {
                throw new BadRequestException('Role name already exists');
            }

            // Convert frontend format to schema format
            const modulePermissions = createRoleDto.modules.map(module => ({
                module,
                permissions: createRoleDto.permissions[module] || []
            }));

            const role = new this.roleModel({
                name: createRoleDto.name,
                description: createRoleDto.description,
                modules: modulePermissions,
                active: createRoleDto.active !== false,
            });

            await role.save();

            this.logger.log(`Role created: ${role.name} (${role._id})`);
            return role.toObject();
        } catch (error) {
            this.logger.error('Error creating role:', error);
            throw error;
        }
    }

    async updateRole(id: string, updateRoleDto: UpdateRoleDto): Promise<Role> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid role ID');
        }

        try {
            const role = await this.roleModel.findById(id);
            if (!role) {
                throw new NotFoundException('Role not found');
            }

            // Check for duplicate name if name is being updated
            if (updateRoleDto.name && updateRoleDto.name !== role.name) {
                const existingRole = await this.roleModel.findOne({
                    name: updateRoleDto.name,
                    active: true,
                    _id: { $ne: id }
                });

                if (existingRole) {
                    throw new BadRequestException('Role name already exists');
                }
            }

            // Update basic fields
            if (updateRoleDto.name) role.name = updateRoleDto.name;
            if (updateRoleDto.description !== undefined) role.description = updateRoleDto.description;
            if (updateRoleDto.active !== undefined) role.active = updateRoleDto.active;

            // Update modules and permissions if provided
            if (updateRoleDto.modules && updateRoleDto.permissions) {
                const modulePermissions = updateRoleDto.modules.map(module => ({
                    module,
                    permissions: updateRoleDto.permissions[module] || []
                }));
                role.modules = modulePermissions;
            }

            await role.save();

            this.logger.log(`Role updated: ${role.name} (${role._id})`);
            return role.toObject();
        } catch (error) {
            this.logger.error('Error updating role:', error);
            throw error;
        }
    }

    async deleteRole(id: string): Promise<void> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid role ID');
        }

        try {
            const role = await this.roleModel.findById(id);
            if (!role) {
                throw new NotFoundException('Role not found');
            }

            // Check if any staff members are using this role
            const staffCount = await this.staffModel.countDocuments({
                roleId: id,
                isActive: true
            });

            if (staffCount > 0) {
                throw new BadRequestException(
                    `Cannot delete role. ${staffCount} staff member(s) are assigned to this role. Please reassign them first.`
                );
            }

            // Soft delete by setting active to false
            role.active = false;
            await role.save();

            this.logger.log(`Role deleted: ${role.name} (${role._id})`);
        } catch (error) {
            this.logger.error('Error deleting role:', error);
            throw error;
        }
    }

    async getRolesByIds(roleIds: string[]): Promise<Role[]> {
        const validIds = roleIds.filter(id => Types.ObjectId.isValid(id));

        return this.roleModel
            .find({
                _id: { $in: validIds },
                active: true
            })
            .select('name description modules')
            .lean();
    }

    async hasPermission(roleId: string, module: string, permission: string): Promise<boolean> {
        if (!Types.ObjectId.isValid(roleId)) {
            return false;
        }

        const role = await this.roleModel.findById(roleId).lean();
        if (!role || !role.active) {
            return false;
        }

        // Find the module in the role's modules array
        const modulePermission = role.modules.find(m => m.module === module);
        if (!modulePermission) {
            return false;
        }

        // Check if role has the specific permission for the module
        return modulePermission.permissions.includes(permission) ||
            modulePermission.permissions.includes('manage');
    }
}
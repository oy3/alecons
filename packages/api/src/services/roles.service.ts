import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
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

    async getAllRoles(includeInactive = false): Promise<Role[]> {
        return this.roleModel
            .find(includeInactive ? {} : { active: true })
            .select('name description modules active createdAt')
            .sort({ active: -1, name: 1 })
            .lean();
    }

    async updateRoleStatus(id: string, active: boolean): Promise<Role> {
        if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid role ID');
        const role = await this.roleModel.findById(id);
        if (!role) throw new NotFoundException('Role not found');
        if (role.active === active) return role.toObject();

        if (!active) {
            const staffCount = await this.staffModel.countDocuments({ roleId: role._id, isActive: true });
            if (staffCount > 0) {
                throw new ConflictException(
                    `Cannot deactivate ${role.name}. ${staffCount} active staff member(s) are assigned to this role. Reassign them first.`,
                );
            }
        }

        role.active = active;
        await role.save();
        this.logger.log(`Role ${active ? 'activated' : 'deactivated'}: ${role.name} (${role._id})`);
        return role.toObject();
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
            const normalizedName = this.normalizeRoleName(createRoleDto.name);
            const existingRole = await this.roleModel.findOne({
                name: this.exactNameMatch(normalizedName),
            }).select('_id name active').lean();

            if (existingRole) {
                throw new ConflictException(
                    `A role named "${existingRole.name}" already exists${existingRole.active ? '' : ' but is inactive'}. Choose another name or update the existing role.`,
                );
            }

            // Convert frontend format to schema format
            const modulePermissions = createRoleDto.modules.map(module => ({
                module,
                permissions: createRoleDto.permissions[module] || []
            }));

            const role = new this.roleModel({
                name: normalizedName,
                description: createRoleDto.description,
                modules: modulePermissions,
                active: createRoleDto.active !== false,
            });

            await role.save();

            this.logger.log(`Role created: ${role.name} (${role._id})`);
            return role.toObject();
        } catch (error) {
            this.logger.error('Error creating role:', error);
            if (error?.code === 11000) {
                throw new ConflictException('A role with this name already exists. Choose another name or update the existing role.');
            }
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

            const normalizedName = updateRoleDto.name === undefined
                ? undefined
                : this.normalizeRoleName(updateRoleDto.name);

            if (normalizedName) {
                const existingRole = await this.roleModel.findOne({
                    name: this.exactNameMatch(normalizedName),
                    _id: { $ne: role._id },
                }).select('_id name active').lean();

                if (existingRole) {
                    throw new ConflictException(
                        `A role named "${existingRole.name}" already exists${existingRole.active ? '' : ' but is inactive'}. Choose another name or update the existing role.`,
                    );
                }
            }

            // Update basic fields
            if (normalizedName) role.name = normalizedName;
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
            if (error?.code === 11000) {
                throw new ConflictException('A role with this name already exists. Choose another name or update the existing role.');
            }
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

    async getUserModuleAccess(userId: string, module: string): Promise<{
        roleId: string;
        roleName: string;
        permissions: string[];
    } | null> {
        if (!Types.ObjectId.isValid(userId)) return null;

        const staff = await this.staffModel
            .findOne({ userId: new Types.ObjectId(userId), isActive: true })
            .select('roleId')
            .lean();
        if (!staff?.roleId) return null;

        const role = await this.roleModel
            .findOne({ _id: staff.roleId, active: true })
            .select('name modules')
            .lean();
        if (!role) return null;

        const moduleAccess = role.modules.find((entry) => entry.module === module);
        if (!moduleAccess) return null;

        return {
            roleId: String(role._id),
            roleName: role.name,
            permissions: [...(moduleAccess.permissions || [])],
        };
    }

    private normalizeRoleName(name: string): string {
        const normalized = String(name || '').trim().replace(/\s+/g, ' ');
        if (!normalized) throw new BadRequestException('Role name is required');
        return normalized;
    }

    private exactNameMatch(name: string): RegExp {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`^${escaped}$`, 'i');
    }
}

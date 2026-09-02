import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { User, UserDocument, UserRole } from '../schemas/user.schema';

export type ContactEnquiryAccessContext = {
  actorId: Types.ObjectId;
  isAdmin: boolean;
  permissions: Set<string>;
};

@Injectable()
export class ContactEnquiryAccessService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
  ) {}

  async context(userId: string): Promise<ContactEnquiryAccessContext> {
    if (!Types.ObjectId.isValid(userId)) throw new ForbiddenException('Invalid staff account');
    const actorId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(actorId).select('role isActive').lean();
    if (!user?.isActive) throw new ForbiddenException('Staff account is inactive');
    if (user.role === UserRole.ADMIN) return { actorId, isAdmin: true, permissions: new Set(['manage']) };

    const staff = await this.staffModel.findOne({ userId: actorId, isActive: true }).select('roleId').lean();
    const role = staff?.roleId
      ? await this.roleModel.findOne({ _id: staff.roleId, active: true }).select('modules').lean()
      : null;
    const moduleAccess = role?.modules?.find((entry) => entry.module === 'enquiries');
    return { actorId, isAdmin: false, permissions: new Set(moduleAccess?.permissions || []) };
  }

  async assertPermission(userId: string, permission: string): Promise<ContactEnquiryAccessContext> {
    const context = await this.context(userId);
    const viewImpliedBy = ['respond', 'add_note', 'update_status', 'assign', 'export'];
    const hasPermission = context.permissions.has(permission)
      || (permission === 'view' && viewImpliedBy.some((item) => context.permissions.has(item)));
    if (!context.isAdmin && !context.permissions.has('manage') && !hasPermission) {
      throw new ForbiddenException('You do not have the required enquiries permission');
    }
    return context;
  }

  hasGlobalQueue(context: ContactEnquiryAccessContext): boolean {
    return context.isAdmin || context.permissions.has('manage') || context.permissions.has('assign');
  }
}

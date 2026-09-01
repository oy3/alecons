import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserRole } from '../schemas/user.schema';
import { Staff, StaffDocument } from '../schemas/staff.schema';
import { Role, RoleDocument } from '../schemas/role.schema';
import { Department, DepartmentDocument } from '../schemas/department.schema';
import { Program, ProgramDocument } from '../schemas/program.schema';
import { ProgramCourse, ProgramCourseDocument } from '../schemas/program-course.schema';

export type ReportAccessScope = {
  unrestricted: boolean;
  departmentIds: Types.ObjectId[];
  programIds: Types.ObjectId[];
  programCourseIds: Types.ObjectId[];
};

@Injectable()
export class ReportsAccessService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Staff.name) private readonly staffModel: Model<StaffDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(Department.name) private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Program.name) private readonly programModel: Model<ProgramDocument>,
    @InjectModel(ProgramCourse.name) private readonly programCourseModel: Model<ProgramCourseDocument>,
  ) {}

  async assertPermission(userId: string, permission: string): Promise<ReportAccessScope> {
    const context = await this.permissionContext(userId);
    if (!context.isAdmin && !context.permissions.has(permission) && !context.permissions.has('manage')) {
      throw new ForbiddenException('You do not have the required reports permission');
    }
    if (context.isAdmin || context.permissions.has('manage')) return this.unrestricted();
    return this.ownershipScope(context.actorId, context.roleName);
  }

  async assertAnyPermission(userId: string, permissions: string[]): Promise<ReportAccessScope> {
    const context = await this.permissionContext(userId);
    if (!context.isAdmin && !context.permissions.has('manage') && !permissions.some((item) => context.permissions.has(item))) {
      throw new ForbiddenException('You do not have access to reports');
    }
    if (context.isAdmin || context.permissions.has('manage')) return this.unrestricted();
    return this.ownershipScope(context.actorId, context.roleName);
  }

  async canManage(userId: string): Promise<boolean> {
    try {
      const context = await this.permissionContext(userId);
      return context.isAdmin || context.permissions.has('manage');
    } catch {
      return false;
    }
  }

  async assertUtilityManage(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) throw new ForbiddenException('Invalid staff account');
    const actorId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(actorId).select('role').lean();
    if (!user) throw new ForbiddenException('User account not found');
    if (user.role === UserRole.ADMIN) return;
    const staff = await this.staffModel.findOne({ userId: actorId, isActive: true }).select('roleId').lean();
    const role = staff?.roleId
      ? await this.roleModel.findOne({ _id: staff.roleId, active: true }).select('modules').lean()
      : null;
    const utilities = role?.modules?.find((entry) => entry.module === 'utilities');
    if (!utilities?.permissions?.includes('manage')) {
      throw new ForbiddenException('Utilities Manage All permission is required');
    }
  }

  private async permissionContext(userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new ForbiddenException('Invalid staff account');
    const actorId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(actorId).select('role').lean();
    if (!user) throw new ForbiddenException('User account not found');
    if (user.role === UserRole.ADMIN) return { actorId, isAdmin: true, permissions: new Set<string>(), roleName: 'administrator' };
    const staff = await this.staffModel.findOne({ userId: actorId, isActive: true }).select('roleId').lean();
    const role = staff?.roleId
      ? await this.roleModel.findOne({ _id: staff.roleId, active: true }).select('name modules').lean()
      : null;
    const access = role?.modules?.find((entry) => entry.module === 'reports');
    return { actorId, isAdmin: false, permissions: new Set<string>(access?.permissions || []), roleName: String(role?.name || '').toLowerCase() };
  }

  private async ownershipScope(actorId: Types.ObjectId, roleName: string): Promise<ReportAccessScope> {
    const [departments, advisedPrograms, lecturedCourses] = await Promise.all([
      this.departmentModel.find({ hodUserId: actorId }).select('_id').lean(),
      this.programModel.find({ courseAdvisorId: actorId }).select('_id departmentId').lean(),
      this.programCourseModel.find({ lecturerIds: actorId }).select('_id programId').lean(),
    ]);
    const departmentIds = this.uniqueIds(departments.map((item: any) => item._id));
    const programIds = this.uniqueIds([
      ...advisedPrograms.map((item: any) => item._id),
      ...lecturedCourses.map((item: any) => item.programId),
    ]);
    const programCourseIds = this.uniqueIds(lecturedCourses.map((item: any) => item._id));
    const isAcademicOwner = departmentIds.length > 0 || programIds.length > 0 || programCourseIds.length > 0;
    const requiresAcademicOwnership = ['hod', 'lecturer', 'course advisor'].includes(roleName.trim());
    return isAcademicOwner
      ? { unrestricted: false, departmentIds, programIds, programCourseIds }
      : requiresAcademicOwnership
        ? { unrestricted: false, departmentIds: [], programIds: [], programCourseIds: [] }
        : this.unrestricted();
  }

  private unrestricted(): ReportAccessScope {
    return { unrestricted: true, departmentIds: [], programIds: [], programCourseIds: [] };
  }

  private uniqueIds(values: unknown[]): Types.ObjectId[] {
    return [...new Set(values.filter(Boolean).map((value: any) => String(value)))].map((value) => new Types.ObjectId(value));
  }
}

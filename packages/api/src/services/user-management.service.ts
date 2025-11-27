import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { User, UserDocument, UserRole } from "../schemas/user.schema";
import { Staff, StaffDocument } from "../schemas/staff.schema";
import { Role, RoleDocument } from "../schemas/role.schema";
import { EmailService } from "./email.service";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";
import { CreateStaffDto } from "../dto/create-staff.dto";
import { UpdateStaffDto } from "../dto/update-staff.dto";

@Injectable()
export class UserManagementService {
    private readonly logger = new Logger(UserManagementService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Staff.name) private staffModel: Model<StaffDocument>,
        @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
        private emailService: EmailService
    ) { }

    private async generateStaffId(department: string): Promise<string> {
        const prefix = "ALCN";
        let deptCode = "ADM"; // Default to Administration

        if (department === "Academics") {
            deptCode = "ACD";
        } else if (department === "Administration") {
            deptCode = "ADM";
        }

        // Get all staff IDs to find the highest number across all departments
        const allStaff = await this.staffModel.find({}, { staffId: 1 }).lean();

        let highestNumber = 0;

        // Extract numbers from all staff IDs (regardless of department prefix)
        allStaff.forEach(staff => {
            if (staff.staffId) {
                // Extract the number part after the last '/'
                const parts = staff.staffId.split('/');
                if (parts.length === 3) {
                    const numberPart = parseInt(parts[2], 10);
                    if (!isNaN(numberPart) && numberPart > highestNumber) {
                        highestNumber = numberPart;
                    }
                }
            }
        });

        // Increment by 1 for the next ID
        const nextNumber = highestNumber + 1;

        // Format number with leading zeros up to 3 digits, then continue without padding
        let formattedNumber;
        if (nextNumber <= 999) {
            formattedNumber = nextNumber.toString().padStart(3, '0');
        } else {
            formattedNumber = nextNumber.toString();
        }

        return `${prefix}/${deptCode}/${formattedNumber}`;
    }

    /**
     * Generate a secure random password with:
     * - At least 1 uppercase letter
     * - At least 1 lowercase letter
     * - At least 1 number
     * - At least 1 special character
     * - Minimum length of 12 characters
     */
    private generateRandomPassword(): string {
        const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
        const numberChars = '0123456789';
        const specialChars = '!@#$%^&*';

        // Ensure at least one of each type
        const password = [
            uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)],
            lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)],
            numberChars[Math.floor(Math.random() * numberChars.length)],
            specialChars[Math.floor(Math.random() * specialChars.length)],
        ];

        // Fill the rest with random characters from all sets
        const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
        const remainingLength = 12 - password.length; // Total length 12

        for (let i = 0; i < remainingLength; i++) {
            password.push(allChars[Math.floor(Math.random() * allChars.length)]);
        }

        // Shuffle the password array to randomize position of required characters
        for (let i = password.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [password[i], password[j]] = [password[j], password[i]];
        }

        return password.join('');
    }

    async getUsers(page: number, limit: number, filters: any) {
        const skip = (page - 1) * limit;
        const query: any = {};

        // Build query based on filters
        if (filters.role && filters.role !== "all") {
            query.role = filters.role;
        }

        if (filters.status !== undefined) {
            query.isActive = filters.status;
        }

        if (filters.search) {
            query.$or = [
                { firstName: { $regex: filters.search, $options: "i" } },
                { lastName: { $regex: filters.search, $options: "i" } },
                { email: { $regex: filters.search, $options: "i" } },
            ];
        }

        const [users, total] = await Promise.all([
            this.userModel
                .find(query)
                .select("-passwordHash -emailVerificationToken")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.userModel.countDocuments(query),
        ]);

        // Get staff details for staff/admin users
        const usersWithStaffInfo = await Promise.all(
            users.map(async (user) => {
                if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
                    const staff = await this.staffModel
                        .findOne({ userId: user._id })
                        .populate("roleId")
                        .lean();

                    if (staff) {
                        const role = staff.roleId as any;
                        return {
                            ...user,
                            staffId: staff.staffId,
                            department: staff.department,
                            position: staff.position,
                            roleId: role._id,
                            roleName: role.name,
                            staffIsActive: staff.isActive,
                        };
                    }
                }
                return user;
            })
        );

        return {
            users: usersWithStaffInfo,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async getUserById(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const user = await this.userModel
            .findById(id)
            .select("-passwordHash -emailVerificationToken")
            .lean();

        if (!user) {
            throw new NotFoundException("User not found");
        }

        // Get staff details if applicable
        if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
            const staff = await this.staffModel
                .findOne({ userId: user._id })
                .populate("roleId")
                .lean();

            if (staff) {
                const role = staff.roleId as any;
                return {
                    ...user,
                    staffId: staff.staffId,
                    department: staff.department,
                    position: staff.position,
                    roleId: role._id,
                    roleName: role.name,
                    roleModules: role.modules,
                    staffIsActive: staff.isActive,
                };
            }
        }

        return user;
    }

    async getRoles() {
        return this.roleModel
            .find({ active: true })
            .select("name description modules")
            .lean();
    }

    async createAdminUser(createUserDto: CreateUserDto) {
        const password = this.generateRandomPassword();

        const user = new this.userModel({
            ...createUserDto,
            passwordHash: password, // Raw password - schema will hash it
            role: UserRole.ADMIN,
            isActive: createUserDto.isActive !== false,
            isEmailVerified: false, // Fixed: should be false for new users
        });

        await user.save();

        // Send email with login credentials
        try {
            await this.emailService.sendAdminLoginCredentials(
                user.email,
                user.firstName,
                password
            );
        } catch (error) {
            this.logger.error("Failed to send admin login credentials email:", error);
        }

        return {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
        };
    }

    async createUnifiedStaffUser(createStaffDto: any) {
        const { roleId, department, position, type, isActive, ...userDto } = createStaffDto;

        // Validate roleId is a valid ObjectId
        if (!Types.ObjectId.isValid(roleId)) {
            throw new NotFoundException("Invalid role ID");
        }

        const password = this.generateRandomPassword();

        // Determine the role based on type
        const role = type === 'admin' ? UserRole.ADMIN : UserRole.STAFF;

        // Create user record (saved in users collection)
        // Note: passwordHash will be hashed by the schema's pre-save hook
        const user = new this.userModel({
            ...userDto,
            passwordHash: password, // Raw password - schema will hash it
            role: role,
            isActive: isActive !== false,
            isEmailVerified: false, // Fixed: should be false for new users
        });

        await user.save();

        // Generate unique staff ID (sequential numbering ensures uniqueness)
        const staffId = await this.generateStaffId(department);

        // Create staff record (saved in staff collection) 
        const staff = new this.staffModel({
            userId: user._id,
            staffId,
            department,
            position,
            roleId: new Types.ObjectId(roleId), // Convert string to ObjectId
            isActive: isActive !== false,
        });

        await staff.save();

        // Send email with login credentials asynchronously (don't block response)
        setImmediate(async () => {
            try {
                if (type === 'admin') {
                    await this.emailService.sendAdminLoginCredentials(
                        user.email,
                        user.firstName,
                        password
                    );
                    this.logger.log(`Admin login credentials email queued for ${user.email}`);
                } else {
                    await this.emailService.sendStaffLoginCredentials(
                        user.email,
                        user.firstName,
                        password,
                        staffId
                    );
                    this.logger.log(`Staff login credentials email queued for ${user.email}`);
                }
            } catch (error) {
                this.logger.error(`Failed to send login credentials email to ${user.email}:`, error.message);
                // Note: Staff creation succeeded, only email failed
            }
        });

        return {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            staffId: staffId,
            department: department,
            position: position,
            isActive: user.isActive,
        };
    }

    async createStaffUser(createStaffDto: CreateStaffDto) {
        const { roleId, department, position, isActive, ...userDto } =
            createStaffDto;

        // Validate roleId is a valid ObjectId
        if (!Types.ObjectId.isValid(roleId)) {
            throw new NotFoundException("Invalid role ID");
        }

        const password = this.generateRandomPassword();

        // Check if role exists
        const role = await this.roleModel.findById(roleId);
        if (!role) {
            throw new NotFoundException("Role not found");
        }

        // Create user
        const user = new this.userModel({
            ...userDto,
            passwordHash: password, // Raw password - schema will hash it
            role: UserRole.STAFF,
            isActive: isActive !== false,
            isEmailVerified: false, // Fixed: should be false for new users
        });

        await user.save();

        // Generate unique staff ID (sequential numbering ensures uniqueness)
        const staffId = await this.generateStaffId(department);

        // Create staff record
        const staff = new this.staffModel({
            userId: user._id,
            staffId,
            department,
            position,
            roleId: new Types.ObjectId(roleId), // Convert string to ObjectId
            isActive: isActive !== false,
        });

        await staff.save();

        // Send email with login credentials asynchronously (don't block response)
        setImmediate(async () => {
            try {
                await this.emailService.sendStaffLoginCredentials(
                    user.email,
                    user.firstName,
                    password,
                    staffId
                );
                this.logger.log(`Staff login credentials email queued for ${user.email}`);
            } catch (error) {
                this.logger.error(`Failed to send staff login credentials email to ${user.email}:`, error.message);
                // Note: Staff creation succeeded, only email failed
            }
        });

        return {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,
            staffId: staff.staffId,
            department: staff.department,
            position: staff.position,
            roleName: role.name,
        };
    }

    async updateUser(id: string, updateUserDto: UpdateUserDto) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const user = await this.userModel
            .findByIdAndUpdate(id, updateUserDto, { new: true, runValidators: true })
            .select("-passwordHash -emailVerificationToken");

        if (!user) {
            throw new NotFoundException("User not found");
        }

        return user;
    }

    async updateStaff(id: string, updateStaffDto: UpdateStaffDto) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const { roleId, department, position, ...userUpdates } = updateStaffDto;

        // Update user record
        const user = await this.userModel
            .findByIdAndUpdate(id, userUpdates, { new: true, runValidators: true })
            .select("-passwordHash -emailVerificationToken");

        if (!user) {
            throw new NotFoundException("User not found");
        }

        // Update staff record if staff-specific fields are provided
        if (roleId || department || position) {
            // Validate roleId if provided
            if (roleId && !Types.ObjectId.isValid(roleId)) {
                throw new NotFoundException("Invalid role ID");
            }

            const staffUpdates: any = {};
            if (roleId) staffUpdates.roleId = new Types.ObjectId(roleId); // Convert string to ObjectId
            if (department) staffUpdates.department = department;
            if (position) staffUpdates.position = position;

            await this.staffModel.findOneAndUpdate({ userId: new Types.ObjectId(id) }, staffUpdates, {
                new: true,
            });
        }

        return this.getUserById(id);
    }

    async updateUserStatus(id: string, isActive: boolean) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const user = await this.userModel
            .findByIdAndUpdate(id, { isActive }, { new: true })
            .select("-passwordHash -emailVerificationToken");

        if (!user) {
            throw new NotFoundException("User not found");
        }

        // Also update staff status if applicable
        if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
            await this.staffModel.findOneAndUpdate(
                { userId: new Types.ObjectId(id) },
                { isActive },
                { new: true }
            );
        }

        return user;
    }

    async resetUserPassword(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException("User not found");
        }

        const newPassword = this.generateRandomPassword();
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await this.userModel.findByIdAndUpdate(id, { passwordHash });

        // Send email with new password
        try {
            await this.emailService.sendPasswordReset(
                user.email,
                user.firstName,
                newPassword
            );
        } catch (error) {
            this.logger.error("Failed to send password reset email:", error);
            // Rollback password change if email fails
            await this.userModel.findByIdAndUpdate(id, { passwordHash: user.passwordHash });
            throw new Error(
                `Failed to send password reset email to ${user.email}. Please check email configuration and try again.`
            );
        }

        return { message: "Password reset successfully" };
    }

    async deleteUser(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new NotFoundException("Invalid user ID");
        }

        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException("User not found");
        }

        // Delete staff record if exists (convert string id to ObjectId for matching)
        if (user.role === UserRole.STAFF || user.role === UserRole.ADMIN) {
            const deleteResult = await this.staffModel.deleteOne({ userId: new Types.ObjectId(id) });
            console.log(`Deleted ${deleteResult.deletedCount} staff record(s) for user ${id}`);
        }

        // Delete user
        await this.userModel.findByIdAndDelete(id);

        console.log(`User ${id} deleted successfully`);
    }
}

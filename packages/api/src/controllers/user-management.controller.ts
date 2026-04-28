import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import { UserRole } from "../schemas/user.schema";
import { UserManagementService } from "../services/user-management.service";
import { CreateUserDto } from "../dto/create-user.dto";
import { UpdateUserDto } from "../dto/update-user.dto";
import { CreateStaffDto } from "../dto/create-staff.dto";
import { UpdateStaffDto } from "../dto/update-staff.dto";

@Controller("staff/users")
@UseGuards(JwtAuthGuard)
// @Roles(UserRole.ADMIN, UserRole.STAFF)
export class UserManagementController {
    private readonly logger = new Logger(UserManagementController.name);

    constructor(private readonly userManagementService: UserManagementService) { }

    @Get()
    async getUsers(
        @Query("page") page = "1",
        @Query("limit") limit = "10",
        @Query("role") role?: string,
        @Query("status") status?: string,
        @Query("search") search?: string
    ) {
        try {
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            const filters = {
                role: role || undefined,
                status:
                    status === "active"
                        ? true
                        : status === "inactive"
                            ? false
                            : undefined,
                search: search || undefined,
            };

            const result = await this.userManagementService.getUsers(
                pageNum,
                limitNum,
                filters
            );

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            this.logger.error("Get users failed:", error);
            throw new HttpException(
                { message: "Failed to fetch users", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("roles")
    async getRoles() {
        try {
            const roles = await this.userManagementService.getRoles();
            return {
                success: true,
                data: roles,
            };
        } catch (error) {
            this.logger.error("Get roles failed:", error);
            throw new HttpException(
                { message: "Failed to fetch roles", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get(":id")
    async getUser(@Param("id") id: string) {
        try {
            const user = await this.userManagementService.getUserById(id);
            return {
                success: true,
                data: user,
            };
        } catch (error) {
            this.logger.error("Get user failed:", error);
            throw new HttpException(
                { message: "Failed to fetch user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post()
    async createUser(@Body() userData: any) {
        try {
            this.logger.log("Creating user with data:", userData);

            // Validate required fields
            if (!userData.firstName || !userData.lastName || !userData.email || !userData.type) {
                throw new HttpException(
                    { message: "Missing required fields: firstName, lastName, email, type" },
                    HttpStatus.BAD_REQUEST
                );
            }

            // For both admin and staff, they need department, position, and roleId
            // as they are all staff members with different roles
            if (!userData.department || !userData.position || !userData.roleId) {
                throw new HttpException(
                    { message: "Missing required fields: department, position, roleId" },
                    HttpStatus.BAD_REQUEST
                );
            }

            // Use unified staff creation for both admin and staff
            const user = await this.userManagementService.createUnifiedStaffUser({
                firstName: userData.firstName,
                lastName: userData.lastName,
                otherName: userData.otherName,
                email: userData.email,
                phone: userData.phone,
                department: userData.department,
                position: userData.position,
                roleId: userData.roleId,
                type: userData.type, // 'admin' or 'staff'
                isActive: userData.isActive !== false
            });

            return {
                success: true,
                message: `${userData.type.charAt(0).toUpperCase() + userData.type.slice(1)} user created successfully`,
                data: user,
            };
        } catch (error) {
            this.logger.error("Create user failed:", error);
            if (error.code === 11000) {
                throw new HttpException(
                    { message: "Email already exists" },
                    HttpStatus.CONFLICT
                );
            }
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                { message: "Failed to create user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post("admin")
    @Roles(UserRole.ADMIN)
    async createAdmin(@Body() createUserDto: CreateUserDto) {
        try {
            const user = await this.userManagementService.createAdminUser(
                createUserDto
            );
            return {
                success: true,
                message: "Admin user created successfully",
                data: user,
            };
        } catch (error) {
            this.logger.error("Create admin failed:", error);
            if (error.code === 11000) {
                throw new HttpException(
                    { message: "Email already exists" },
                    HttpStatus.CONFLICT
                );
            }
            throw new HttpException(
                { message: "Failed to create admin user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post("staff")
    @Roles(UserRole.ADMIN)
    async createStaff(@Body() createStaffDto: CreateStaffDto) {
        try {
            const staff = await this.userManagementService.createStaffUser(
                createStaffDto
            );
            return {
                success: true,
                message: "Staff user created successfully",
                data: staff,
            };
        } catch (error) {
            this.logger.error("Create staff failed:", error);
            if (error.code === 11000) {
                throw new HttpException(
                    { message: "Email already exists" },
                    HttpStatus.CONFLICT
                );
            }
            throw new HttpException(
                { message: "Failed to create staff user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":id")
    @Roles(UserRole.ADMIN)
    async updateUser(
        @Param("id") id: string,
        @Body() updateUserDto: UpdateUserDto
    ) {
        try {
            const user = await this.userManagementService.updateUser(
                id,
                updateUserDto
            );
            return {
                success: true,
                message: "User updated successfully",
                data: user,
            };
        } catch (error) {
            this.logger.error("Update user failed:", error);
            throw new HttpException(
                { message: "Failed to update user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":id/staff")
    @Roles(UserRole.ADMIN)
    async updateStaff(
        @Param("id") id: string,
        @Body() updateStaffDto: UpdateStaffDto
    ) {
        try {
            const staff = await this.userManagementService.updateStaff(
                id,
                updateStaffDto
            );
            return {
                success: true,
                message: "Staff updated successfully",
                data: staff,
            };
        } catch (error) {
            this.logger.error("Update staff failed:", error);
            throw new HttpException(
                { message: "Failed to update staff", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":id/status")
    @Roles(UserRole.ADMIN)
    async updateUserStatus(
        @Param("id") id: string,
        @Body() statusData: { isActive: boolean }
    ) {
        try {
            const user = await this.userManagementService.updateUserStatus(
                id,
                statusData.isActive
            );
            return {
                success: true,
                message: `User ${statusData.isActive ? "activated" : "deactivated"
                    } successfully`,
                data: user,
            };
        } catch (error) {
            this.logger.error("Update user status failed:", error);
            throw new HttpException(
                { message: "Failed to update user status", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post(":id/reset-password")
    @Roles(UserRole.ADMIN)
    async resetPassword(@Param("id") id: string) {
        try {
            const result = await this.userManagementService.resetUserPassword(id);
            return {
                success: true,
                message:
                    "Password reset successfully. New password sent to user email.",
                data: result,
            };
        } catch (error) {
            this.logger.error("Reset password failed:", error);
            throw new HttpException(
                { message: "Failed to reset password", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Delete(":id")
    @Roles(UserRole.ADMIN)
    async deleteUser(@Param("id") id: string) {
        try {
            await this.userManagementService.deleteUser(id);
            return {
                success: true,
                message: "User deleted successfully",
            };
        } catch (error) {
            this.logger.error("Delete user failed:", error);
            throw new HttpException(
                { message: "Failed to delete user", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

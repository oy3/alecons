import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import { UserRole } from "../schemas/user.schema";
import { RolesService } from "../services/roles.service";
import { CreateRoleDto, UpdateRoleDto, UpdateRoleStatusDto } from "../dto/role.dto";

@Controller("staff/roles")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class RolesController {
    private readonly logger = new Logger(RolesController.name);

    constructor(private readonly rolesService: RolesService) { }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    async getAllRoles() {
        try {
            const roles = await this.rolesService.getAllRoles();
            return {
                success: true,
                data: roles,
            };
        } catch (error) {
            this.logger.error("Get all roles failed:", error);
            throw new HttpException(
                { message: "Failed to fetch roles", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get("management")
    @Roles(UserRole.ADMIN)
    async getManagedRoles() {
        return {
            success: true,
            data: await this.rolesService.getAllRoles(true),
        };
    }

    @Get(":id")
    @Roles(UserRole.ADMIN, UserRole.STAFF)
    async getRole(@Param("id") id: string) {
        try {
            const role = await this.rolesService.getRoleById(id);
            return {
                success: true,
                data: role,
            };
        } catch (error) {
            this.logger.error("Get role failed:", error);
            throw new HttpException(
                { message: "Failed to fetch role", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Post()
    @Roles(UserRole.ADMIN)
    async createRole(@Body() createRoleDto: CreateRoleDto) {
        try {
            this.logger.log("Creating role with data:", createRoleDto);

            // Validate required fields
            if (!createRoleDto.name || !createRoleDto.modules || !createRoleDto.permissions) {
                throw new HttpException(
                    { message: "Missing required fields: name, modules, permissions" },
                    HttpStatus.BAD_REQUEST
                );
            }

            const role = await this.rolesService.createRole(createRoleDto);
            return {
                success: true,
                message: "Role created successfully",
                data: role,
            };
        } catch (error) {
            this.logger.error("Create role failed:", error);
            if (error.code === 11000) {
                throw new HttpException(
                    { message: "Role name already exists" },
                    HttpStatus.CONFLICT
                );
            }
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                { message: "Failed to create role", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Put(":id")
    @Roles(UserRole.ADMIN)
    async updateRole(@Param("id") id: string, @Body() updateRoleDto: UpdateRoleDto) {
        try {
            this.logger.log("Updating role:", id, updateRoleDto);

            const role = await this.rolesService.updateRole(id, updateRoleDto);
            return {
                success: true,
                message: "Role updated successfully",
                data: role,
            };
        } catch (error) {
            this.logger.error("Update role failed:", error);
            if (error.code === 11000) {
                throw new HttpException(
                    { message: "Role name already exists" },
                    HttpStatus.CONFLICT
                );
            }
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                { message: "Failed to update role", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Patch(":id/status")
    @Roles(UserRole.ADMIN)
    async updateRoleStatus(@Param("id") id: string, @Body() payload: UpdateRoleStatusDto) {
        const role = await this.rolesService.updateRoleStatus(id, payload.active);
        return {
            success: true,
            message: `Role ${payload.active ? "activated" : "deactivated"} successfully`,
            data: role,
        };
    }

    @Delete(":id")
    @Roles(UserRole.ADMIN)
    async deleteRole(@Param("id") id: string) {
        try {
            this.logger.log("Deleting role:", id);

            await this.rolesService.deleteRole(id);
            return {
                success: true,
                message: "Role deleted successfully",
            };
        } catch (error) {
            this.logger.error("Delete role failed:", error);
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                { message: "Failed to delete role", error: error.message },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}

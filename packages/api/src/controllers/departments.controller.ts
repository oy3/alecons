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
    Patch,
    Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepartmentsService } from '../services/departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto, QueryDepartmentsDto } from '../dto/department.dto';

@Controller('departments')
@UseGuards(JwtAuthGuard)
export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) { }

    @Get()
    async getDepartments(@Query() query: QueryDepartmentsDto) {
        try {
            const result = await this.departmentsService.findAll(query);
            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Get('active')
    async getActiveDepartments() {
        try {
            const departments = await this.departmentsService.findAllActive();
            return {
                success: true,
                data: { departments },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Get(':id')
    async getDepartment(@Param('id') id: string) {
        try {
            const department = await this.departmentsService.findById(id);
            return {
                success: true,
                data: { department },
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Post()
    async createDepartment(@Body() createDepartmentDto: CreateDepartmentDto, @Request() req: any) {
        try {
            const department = await this.departmentsService.create(createDepartmentDto, this.getCurrentUserId(req));
            return {
                success: true,
                data: { department },
                message: 'Department created successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Put(':id')
    async updateDepartment(
        @Param('id') id: string,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
        @Request() req: any,
    ) {
        try {
            const department = await this.departmentsService.update(id, updateDepartmentDto, this.getCurrentUserId(req));
            return {
                success: true,
                data: { department },
                message: 'Department updated successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Delete(':id')
    async deleteDepartment(@Param('id') id: string) {
        try {
            await this.departmentsService.delete(id);
            return {
                success: true,
                message: 'Department deleted successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    @Patch(':id/toggle-status')
    async toggleDepartmentStatus(@Param('id') id: string) {
        try {
            const department = await this.departmentsService.toggleStatus(id);
            return {
                success: true,
                data: { department },
                message: 'Department status updated successfully',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }

    private getCurrentUserId(req: any) {
        return req?.user?._id?.toString?.() || req?.user?.id?.toString?.() || req?.user?.sub?.toString?.();
    }
}

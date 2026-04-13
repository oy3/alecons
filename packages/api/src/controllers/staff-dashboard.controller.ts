import { Controller, Get, HttpException, HttpStatus, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../schemas/user.schema';
import { StaffDashboardService } from '../services/staff-dashboard.service';

@ApiTags('Staff Dashboard')
@Controller('staff/dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StaffDashboardController {
    constructor(private readonly staffDashboardService: StaffDashboardService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Get staff dashboard summary stats' })
    @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
    async getStats(@Request() req) {
        try {
            if (![UserRole.ADMIN, UserRole.STAFF].includes(req.user?.role)) {
                throw new HttpException(
                    {
                        success: false,
                        message: 'Unauthorized access',
                    },
                    HttpStatus.FORBIDDEN,
                );
            }

            const result = await this.staffDashboardService.getStats();

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            throw new HttpException(
                {
                    success: false,
                    message: 'Failed to retrieve dashboard stats',
                    error: error.message,
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

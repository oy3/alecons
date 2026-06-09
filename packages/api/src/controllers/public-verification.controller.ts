import { Controller, Get, Logger, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicVerificationService } from '../services/public-verification.service';

@ApiTags('Public Verification')
@Controller('public/verify')
export class PublicVerificationController {
    private readonly logger = new Logger(PublicVerificationController.name);

    constructor(private readonly publicVerificationService: PublicVerificationService) { }

    @Get('v1/:token')
    @ApiOperation({ summary: 'Verify a student or staff ID card using a public token' })
    @ApiResponse({ status: 200, description: 'Verification record retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Verification record not found' })
    async verify(@Param('token') token: string) {
        this.logger.log(`Public verification lookup requested for token prefix: ${String(token || '').slice(0, 10)}`);
        return this.publicVerificationService.getPublicVerificationRecord(token);
    }
}
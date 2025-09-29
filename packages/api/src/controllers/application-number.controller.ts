import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApplicationNumberService } from '../services/application-number.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('/api/v1/admin/application-numbers')
@UseGuards(JwtAuthGuard)
export class ApplicationNumberController {
    constructor(private readonly appNumberService: ApplicationNumberService) { }

    /**
     * Generate a test application number for a program
     */
    @Post('generate')
    async generateApplicationNumber(@Body('programId') programId: string) {
        try {
            const applicationNumber = await this.appNumberService.generateApplicationNumber(programId);
            return {
                success: true,
                data: {
                    applicationNumber,
                    programId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get statistics for application numbers
     */
    @Get('stats')
    async getStats(@Query('year') year?: string) {
        try {
            const targetYear = year ? parseInt(year) : undefined;
            const stats = await this.appNumberService.getApplicationNumberStats(targetYear);
            return {
                success: true,
                data: stats
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get counter status for a specific program
     */
    @Get('counter/:programId')
    async getCounterStatus(
        @Param('programId') programId: string,
        @Query('year') year?: string
    ) {
        try {
            const targetYear = year ? parseInt(year) : undefined;
            const counter = await this.appNumberService.getCounterStatus(programId, targetYear);
            return {
                success: true,
                data: counter
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Initialize/reset counter for a program
     */
    @Post('counter/initialize')
    async initializeCounter(@Body() body: {
        programId: string;
        year?: number;
        startSequence?: number;
    }) {
        try {
            await this.appNumberService.initializeCounter(
                body.programId,
                body.year,
                body.startSequence || 0
            );
            return {
                success: true,
                message: 'Counter initialized successfully'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Repair any inconsistencies in counters
     */
    @Post('repair')
    async repairCounters(@Body('year') year?: number) {
        try {
            const result = await this.appNumberService.repairCounters(year);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Validate application number format
     */
    @Post('validate')
    async validateApplicationNumber(@Body('applicationNumber') applicationNumber: string) {
        try {
            const isValid = this.appNumberService.validateApplicationNumber(applicationNumber);
            return {
                success: true,
                data: {
                    applicationNumber,
                    isValid
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProgramsService } from './programs.service';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
    constructor(private readonly programsService: ProgramsService) { }

    @Get('types')
    @ApiOperation({ summary: 'Get all active program types' })
    @ApiResponse({ status: 200, description: 'List of program types retrieved successfully' })
    async getProgramTypes() {
        return this.programsService.getProgramTypes();
    }

    @Get('modes')
    @ApiOperation({ summary: 'Get all active program modes' })
    @ApiResponse({ status: 200, description: 'List of program modes retrieved successfully' })
    async getProgramModes() {
        return this.programsService.getProgramModes();
    }

    @Get()
    @ApiOperation({ summary: 'Get all active programs' })
    @ApiResponse({ status: 200, description: 'List of programs retrieved successfully' })
    async getPrograms() {
        return this.programsService.getPrograms();
    }
}

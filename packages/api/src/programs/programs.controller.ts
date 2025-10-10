import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ProgramsService } from './programs.service';
import {
    CreateProgramDto,
    UpdateProgramDto,
    QueryProgramsDto,
    CreateProgramTypeDto,
    UpdateProgramTypeDto,
    CreateProgramModeDto,
    UpdateProgramModeDto
} from '../dto/program.dto';

@ApiTags('programs')
@Controller('programs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProgramsController {
    constructor(private readonly programsService: ProgramsService) { }

    // Program CRUD endpoints
    @Post()
    @ApiOperation({ summary: 'Create a new program' })
    @ApiResponse({ status: 201, description: 'Program created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async createProgram(@Body() createProgramDto: CreateProgramDto) {
        return this.programsService.createProgram(createProgramDto);
    }

        @Get()
    @Public()  // Make this public for registration access
    @ApiOperation({ summary: 'Get all programs' })
    @ApiResponse({ status: 200, description: 'Programs retrieved successfully' })
    async findAllPrograms(@Query() queryDto: QueryProgramsDto) {
        return this.programsService.findAllPrograms(queryDto);
    }

    // Program Type CRUD endpoints
    @Post('types')
    @ApiOperation({ summary: 'Create a new program type' })
    @ApiResponse({ status: 201, description: 'Program type created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async createProgramType(@Body() createProgramTypeDto: CreateProgramTypeDto) {
        return this.programsService.createProgramType(createProgramTypeDto);
    }

    @Get('types')
    @Public()  // Make this public for registration access
    @ApiOperation({ summary: 'Get all program types' })
    @ApiResponse({ status: 200, description: 'Program types retrieved successfully' })
    async findAllProgramTypes() {
        return this.programsService.findAllProgramTypes();
    }

    @Put('types/:id')
    @ApiOperation({ summary: 'Update a program type' })
    @ApiResponse({ status: 200, description: 'Program type updated successfully' })
    @ApiResponse({ status: 404, description: 'Program type not found' })
    async updateProgramType(@Param('id') id: string, @Body() updateProgramTypeDto: UpdateProgramTypeDto) {
        return this.programsService.updateProgramType(id, updateProgramTypeDto);
    }

    @Delete('types/:id')
    @ApiOperation({ summary: 'Delete a program type' })
    @ApiResponse({ status: 200, description: 'Program type deleted successfully' })
    @ApiResponse({ status: 404, description: 'Program type not found' })
    async deleteProgramType(@Param('id') id: string) {
        return this.programsService.deleteProgramType(id);
    }

    @Put('types/:id/toggle-status')
    @ApiOperation({ summary: 'Toggle program type active status' })
    @ApiResponse({ status: 200, description: 'Program type status toggled successfully' })
    @ApiResponse({ status: 404, description: 'Program type not found' })
    async toggleProgramTypeStatus(@Param('id') id: string) {
        return this.programsService.toggleProgramTypeStatus(id);
    }

    // Program Mode CRUD endpoints
    @Post('modes')
    @ApiOperation({ summary: 'Create a new program mode' })
    @ApiResponse({ status: 201, description: 'Program mode created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request' })
    async createProgramMode(@Body() createProgramModeDto: CreateProgramModeDto) {
        return this.programsService.createProgramMode(createProgramModeDto);
    }

    @Get('modes')
    @Public()  // Make this public for registration access
    @ApiOperation({ summary: 'Get all program modes' })
    @ApiResponse({ status: 200, description: 'Program modes retrieved successfully' })
    async findAllProgramModes() {
        return this.programsService.findAllProgramModes();
    }

    @Put('modes/:id')
    @ApiOperation({ summary: 'Update a program mode' })
    @ApiResponse({ status: 200, description: 'Program mode updated successfully' })
    @ApiResponse({ status: 404, description: 'Program mode not found' })
    async updateProgramMode(@Param('id') id: string, @Body() updateProgramModeDto: UpdateProgramModeDto) {
        return this.programsService.updateProgramMode(id, updateProgramModeDto);
    }

    @Delete('modes/:id')
    @ApiOperation({ summary: 'Delete a program mode' })
    @ApiResponse({ status: 200, description: 'Program mode deleted successfully' })
    @ApiResponse({ status: 404, description: 'Program mode not found' })
    async deleteProgramMode(@Param('id') id: string) {
        return this.programsService.deleteProgramMode(id);
    }

    @Put('modes/:id/toggle-status')
    @ApiOperation({ summary: 'Toggle program mode active status' })
    @ApiResponse({ status: 200, description: 'Program mode status toggled successfully' })
    @ApiResponse({ status: 404, description: 'Program mode not found' })
    async toggleProgramModeStatus(@Param('id') id: string) {
        return this.programsService.toggleProgramModeStatus(id);
    }

    // Program CRUD endpoints with ID
    @Get(':id')
    @ApiOperation({ summary: 'Get a program by ID' })
    @ApiResponse({ status: 200, description: 'Program retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Program not found' })
    async findProgramById(@Param('id') id: string) {
        return this.programsService.findProgramById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a program' })
    @ApiResponse({ status: 200, description: 'Program updated successfully' })
    @ApiResponse({ status: 404, description: 'Program not found' })
    async updateProgram(@Param('id') id: string, @Body() updateProgramDto: UpdateProgramDto) {
        return this.programsService.updateProgram(id, updateProgramDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a program' })
    @ApiResponse({ status: 200, description: 'Program deleted successfully' })
    @ApiResponse({ status: 404, description: 'Program not found' })
    async deleteProgram(@Param('id') id: string) {
        return this.programsService.deleteProgram(id);
    }

    @Put(':id/toggle-status')
    @ApiOperation({ summary: 'Toggle program active status' })
    @ApiResponse({ status: 200, description: 'Program status toggled successfully' })
    @ApiResponse({ status: 404, description: 'Program not found' })
    async toggleProgramStatus(@Param('id') id: string) {
        return this.programsService.toggleProgramStatus(id);
    }
}

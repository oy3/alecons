import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CoursesService } from './courses.service';
import {
    CreateCourseDto,
    CreateProgramCourseDto,
    QueryCoursesDto,
    QueryProgramCoursesDto,
    UpdateCourseDto,
    UpdateProgramCourseDto,
} from '../dto/course.dto';

@ApiTags('Courses')
@Controller('courses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoursesController {
    constructor(private readonly coursesService: CoursesService) { }

    @Get('catalog')
    @ApiOperation({ summary: 'Get course catalog' })
    @ApiResponse({ status: 200, description: 'Course catalog retrieved successfully' })
    async findAllCourses(@Query() queryDto: QueryCoursesDto) {
        return this.coursesService.findAllCourses(queryDto);
    }

    @Get('catalog/options')
    @ApiOperation({ summary: 'Get active courses for select inputs' })
    @ApiResponse({ status: 200, description: 'Active courses retrieved successfully' })
    async getCourseOptions() {
        return this.coursesService.getCourseOptions();
    }

    @Post('catalog')
    @ApiOperation({ summary: 'Create a new course catalog entry' })
    @ApiResponse({ status: 201, description: 'Course created successfully' })
    async createCourse(@Body() createCourseDto: CreateCourseDto) {
        return this.coursesService.createCourse(createCourseDto);
    }

    @Put('catalog/:id')
    @ApiOperation({ summary: 'Update a course catalog entry' })
    @ApiResponse({ status: 200, description: 'Course updated successfully' })
    async updateCourse(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
        return this.coursesService.updateCourse(id, updateCourseDto);
    }

    @Delete('catalog/:id')
    @ApiOperation({ summary: 'Delete a course catalog entry' })
    @ApiResponse({ status: 200, description: 'Course deleted successfully' })
    async deleteCourse(@Param('id') id: string) {
        return this.coursesService.deleteCourse(id);
    }

    @Get('program-mappings')
    @ApiOperation({ summary: 'Get program course mappings' })
    @ApiResponse({ status: 200, description: 'Program course mappings retrieved successfully' })
    async findAllProgramCourses(@Query() queryDto: QueryProgramCoursesDto) {
        return this.coursesService.findAllProgramCourses(queryDto);
    }

    @Post('program-mappings')
    @ApiOperation({ summary: 'Assign a course to a program' })
    @ApiResponse({ status: 201, description: 'Program course created successfully' })
    async createProgramCourse(@Body() createProgramCourseDto: CreateProgramCourseDto) {
        return this.coursesService.createProgramCourse(createProgramCourseDto);
    }

    @Patch('program-mappings/:id')
    @ApiOperation({ summary: 'Update a program course mapping' })
    @ApiResponse({ status: 200, description: 'Program course updated successfully' })
    async updateProgramCourse(@Param('id') id: string, @Body() updateProgramCourseDto: UpdateProgramCourseDto) {
        return this.coursesService.updateProgramCourse(id, updateProgramCourseDto);
    }

    @Delete('program-mappings/:id')
    @ApiOperation({ summary: 'Delete a program course mapping' })
    @ApiResponse({ status: 200, description: 'Program course deleted successfully' })
    async deleteProgramCourse(@Param('id') id: string) {
        return this.coursesService.deleteProgramCourse(id);
    }
}

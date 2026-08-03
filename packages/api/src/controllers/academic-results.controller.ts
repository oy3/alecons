import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcademicResultsService } from '../services/academic-results.service';
import { AcademicResultAttemptType } from '../schemas/academic-result.schema';
import {
  AcademicResultContextDto,
  AmendPublishedAcademicResultDto,
  CreateAcademicResultAttemptDto,
  CreateGradeScaleDto,
  ReviewAcademicResultContextDto,
  SaveAcademicScoresDto,
  UpdateGradeScaleStatusDto,
} from '../dto/academic-result.dto';

@ApiTags('Staff Academic Results')
@ApiBearerAuth()
@Controller('staff/academic-results')
@UseGuards(JwtAuthGuard)
export class AcademicResultsController {
  constructor(private readonly academicResultsService: AcademicResultsService) {}

  @Get('grade-scales')
  async getGradeScales(@Request() req: any) { return { success: true, data: await this.academicResultsService.listGradeScales(this.userId(req)) }; }

  @Post('grade-scales')
  async createGradeScale(@Request() req: any, @Body() payload: CreateGradeScaleDto) {
    return { success: true, data: await this.academicResultsService.createGradeScale(this.userId(req), payload) };
  }

  @Patch('grade-scales/:gradeScaleId/status')
  async updateGradeScaleStatus(@Request() req: any, @Param('gradeScaleId') gradeScaleId: string, @Body() payload: UpdateGradeScaleStatusDto) {
    return { success: true, data: await this.academicResultsService.updateGradeScaleStatus(this.userId(req), gradeScaleId, payload.status) };
  }

  @Get('lecturer-courses')
  async getLecturerCourses(@Request() req: any, @Query('programId') programId?: string, @Query('level') level?: string) {
    return { success: true, data: await this.academicResultsService.getLecturerCourses(this.userId(req), { programId, level: level ? Number(level) : undefined }) };
  }

  @Get('queues/:queue')
  async getWorkflowQueue(@Request() req: any, @Param('queue') queue: 'lecturer' | 'hod' | 'hod-ready' | 'provost' | 'publish' | 'published') {
    return { success: true, data: await this.academicResultsService.getWorkflowQueue(this.userId(req), queue) };
  }

  @Get('readiness')
  async getReadiness(@Request() req: any) { return { success: true, data: await this.academicResultsService.getReadiness(this.userId(req)) }; }

  @Get('program-courses/:programCourseId/score-sheet')
  async getScoreSheet(@Request() req: any, @Param('programCourseId') programCourseId: string, @Query('attemptType') attemptType?: AcademicResultAttemptType) {
    return { success: true, data: await this.academicResultsService.getScoreSheet(this.userId(req), programCourseId, attemptType) };
  }

  @Post('context/report')
  async getContextReport(@Request() req: any, @Body() context: AcademicResultContextDto) {
    return { success: true, data: await this.academicResultsService.getContextReport(this.userId(req), context) };
  }

  @Post('program-courses/:programCourseId/scores')
  async saveScores(@Request() req: any, @Param('programCourseId') programCourseId: string, @Body() payload: SaveAcademicScoresDto) {
    return { success: true, data: await this.academicResultsService.saveScores(this.userId(req), programCourseId, payload) };
  }

  @Post('program-courses/:programCourseId/submit-hod')
  async submitToHod(@Request() req: any, @Param('programCourseId') programCourseId: string, @Query('attemptType') attemptType?: AcademicResultAttemptType) {
    return { success: true, data: await this.academicResultsService.submitToHod(this.userId(req), programCourseId, attemptType) };
  }

  @Post('context/hod-review')
  async hodReview(@Request() req: any, @Body() payload: ReviewAcademicResultContextDto) {
    return { success: true, data: await this.academicResultsService.hodReview(this.userId(req), payload.context, Boolean(payload.approved), payload.comment) };
  }

  @Post('context/submit-provost')
  async submitToProvost(@Request() req: any, @Body() context: AcademicResultContextDto) {
    return { success: true, data: await this.academicResultsService.submitToProvost(this.userId(req), context) };
  }

  @Post('context/provost-review')
  async provostReview(@Request() req: any, @Body() payload: ReviewAcademicResultContextDto) {
    return { success: true, data: await this.academicResultsService.provostReview(this.userId(req), payload.context, Boolean(payload.approved), payload.comment) };
  }

  @Post('context/publish')
  async publish(@Request() req: any, @Body() context: AcademicResultContextDto) {
    return { success: true, data: await this.academicResultsService.publish(this.userId(req), context) };
  }

  @Post('attempts')
  async createAttempt(@Request() req: any, @Body() payload: CreateAcademicResultAttemptDto) {
    return { success: true, data: await this.academicResultsService.createAttempt(this.userId(req), payload) };
  }

  @Post('results/:resultId/amend')
  async amendPublishedResult(@Request() req: any, @Param('resultId') resultId: string, @Body() payload: AmendPublishedAcademicResultDto) {
    return { success: true, data: await this.academicResultsService.amendPublishedResult(this.userId(req), resultId, payload) };
  }

  private userId(req: any) { return req?.user?._id?.toString?.() || req?.user?.id?.toString?.() || req?.user?.sub?.toString?.(); }
}

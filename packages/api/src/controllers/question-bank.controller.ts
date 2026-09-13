import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { QuestionBankService } from '../services/question-bank.service';

@Controller('question-bank')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard, RolesGuard)
@Roles('staff', 'admin')
export class QuestionBankController {
    constructor(private readonly service: QuestionBankService) {}

    @Get()
    async list(@Query() query: any) {
        return { success: true, data: await this.service.list(query) };
    }

    @Get('summary')
    async summary() {
        return { success: true, data: await this.service.summary() };
    }

    @Get('facets')
    async facets() {
        return { success: true, data: await this.service.facets() };
    }

    @Get(':id/usage')
    async usage(@Param('id') id: string) {
        return { success: true, data: await this.service.usage(id) };
    }

    @Post()
    async create(@Body() body: any, @Request() req: any) {
        return { success: true, data: await this.service.create(body, req.user.userId || req.user.id) };
    }

    @Post('bulk')
    async bulkCreate(@Body() body: { questions: any[] }, @Request() req: any) {
        return { success: true, data: await this.service.bulkCreate(body.questions || [], req.user.userId || req.user.id) };
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
        return { success: true, data: await this.service.update(id, body, req.user.userId || req.user.id) };
    }

    @Post('status')
    async setStatus(@Body() body: { ids: string[]; status: 'active' | 'archived' }, @Request() req: any) {
        return { success: true, data: await this.service.setStatus(body.ids || [], body.status, req.user.userId || req.user.id) };
    }

    @Post('reuse/:examId')
    async reuse(@Param('examId') examId: string, @Body() body: { questionBankItemIds: string[] }, @Request() req: any) {
        return { success: true, data: await this.service.reuse(examId, body.questionBankItemIds || [], req.user.userId || req.user.id) };
    }
}

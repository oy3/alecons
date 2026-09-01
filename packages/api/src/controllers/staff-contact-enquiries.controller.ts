import { Body, Controller, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AssignContactEnquiryDto,
  ContactEnquiryListQueryDto,
  ContactEnquiryMessageDto,
  UpdateContactEnquiryDto,
} from '../dto/contact-enquiry.dto';
import { ContactEnquiriesService } from '../services/contact-enquiries.service';
import { Response } from 'express';

@ApiTags('Staff Contact Enquiries')
@ApiBearerAuth()
@Controller('staff/enquiries')
@UseGuards(JwtAuthGuard)
export class StaffContactEnquiriesController {
  constructor(private readonly enquiries: ContactEnquiriesService) {}

  private userId(req: any): string {
    return String(req.user?._id || req.user?.id || req.user?.sub);
  }

  @Get()
  async list(@Request() req: any, @Query() query: ContactEnquiryListQueryDto) {
    return { success: true, data: await this.enquiries.list(this.userId(req), query) };
  }

  @Get('stats')
  async stats(@Request() req: any) {
    return { success: true, data: await this.enquiries.stats(this.userId(req)) };
  }

  @Get('assignees')
  async assignees(@Request() req: any, @Query('search') search = '') {
    return { success: true, data: await this.enquiries.assignees(this.userId(req), search) };
  }

  @Get('export')
  async export(@Request() req: any, @Query() query: ContactEnquiryListQueryDto, @Res() response: Response) {
    const csv = await this.enquiries.exportCsv(this.userId(req), query);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="contact-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(`\uFEFF${csv}`);
  }

  @Get(':id')
  async detail(@Request() req: any, @Param('id') id: string) {
    return { success: true, data: await this.enquiries.detail(this.userId(req), id) };
  }

  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() payload: UpdateContactEnquiryDto) {
    return { success: true, data: await this.enquiries.update(this.userId(req), id, payload) };
  }

  @Post(':id/assign')
  async assign(@Request() req: any, @Param('id') id: string, @Body() payload: AssignContactEnquiryDto) {
    return { success: true, data: await this.enquiries.assign(this.userId(req), id, payload) };
  }

  @Post(':id/notes')
  async addNote(@Request() req: any, @Param('id') id: string, @Body() payload: ContactEnquiryMessageDto) {
    return { success: true, data: await this.enquiries.addNote(this.userId(req), id, payload) };
  }

  @Post(':id/responses')
  async respond(@Request() req: any, @Param('id') id: string, @Body() payload: ContactEnquiryMessageDto) {
    return { success: true, data: await this.enquiries.respond(this.userId(req), id, payload) };
  }

  @Post(':id/responses/:messageId/retry')
  async retry(
    @Request() req: any,
    @Param('id') id: string,
    @Param('messageId') messageId: string,
  ) {
    return { success: true, data: await this.enquiries.retryResponse(this.userId(req), id, messageId) };
  }
}

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreatePublicContactEnquiryDto } from '../dto/contact-enquiry.dto';
import { ContactEnquiriesService } from '../services/contact-enquiries.service';

@ApiTags('Public Contact Enquiries')
@Controller('public/contact-enquiries')
@UseGuards(ThrottlerGuard)
export class PublicContactEnquiriesController {
  constructor(private readonly enquiries: ContactEnquiriesService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() payload: CreatePublicContactEnquiryDto) {
    return {
      success: true,
      message: 'Your enquiry has been received.',
      data: await this.enquiries.createPublic(payload),
    };
  }
}


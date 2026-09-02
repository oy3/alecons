import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { GmailPubSubAuthGuard } from '../guards/gmail-pubsub-auth.guard';
import { ContactEnquiryGmailService } from '../services/contact-enquiry-gmail.service';
import { ContactEnquiryInboundQueueService } from '../services/contact-enquiry-inbound.processor';

type PubSubPushBody = {
  message?: {
    data?: string;
    messageId?: string;
    message_id?: string;
  };
};

@ApiExcludeController()
@Controller('webhooks/google/gmail')
@UseGuards(GmailPubSubAuthGuard)
export class GmailPubSubWebhookController {
  constructor(
    private readonly gmail: ContactEnquiryGmailService,
    private readonly inboundQueue: ContactEnquiryInboundQueueService,
  ) {}

  @Post()
  @HttpCode(204)
  async receive(@Body() payload: PubSubPushBody): Promise<void> {
    if (!this.gmail.isEnabled()) return;

    const message = payload?.message;
    const pubsubMessageId = String(message?.messageId || message?.message_id || '').trim();
    if (!message?.data || !pubsubMessageId) {
      throw new BadRequestException('Invalid Pub/Sub push envelope');
    }

    let notification: { emailAddress?: string; historyId?: string };
    try {
      notification = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid Gmail notification payload');
    }

    const emailAddress = String(notification.emailAddress || '').trim().toLowerCase();
    const historyId = String(notification.historyId || '').trim();
    if (emailAddress !== this.gmail.mailbox() || !/^\d+$/.test(historyId)) {
      throw new BadRequestException('Gmail notification does not match the configured mailbox');
    }

    await this.inboundQueue.enqueue({ pubsubMessageId, emailAddress, historyId });
  }
}

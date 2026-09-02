import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  ContactEnquiryInboundReceipt,
  ContactEnquiryInboundReceiptDocument,
  ContactInboundReceiptStatus,
} from '../schemas/contact-enquiry-inbound-receipt.schema';
import {
  ContactEnquiryMailboxState,
  ContactEnquiryMailboxStateDocument,
} from '../schemas/contact-enquiry-mailbox-state.schema';
import {
  ContactEnquiryMessage,
  ContactEnquiryMessageDocument,
} from '../schemas/contact-enquiry-message.schema';
import { ContactEnquiry, ContactEnquiryDocument } from '../schemas/contact-enquiry.schema';
import { ContactEnquiriesService } from './contact-enquiries.service';
import { ContactEnquiryGmailService, GmailInboundMessage } from './contact-enquiry-gmail.service';

@Injectable()
export class ContactEnquiryInboundService {
  private readonly logger = new Logger(ContactEnquiryInboundService.name);

  constructor(
    @InjectModel(ContactEnquiryMailboxState.name)
    private readonly stateModel: Model<ContactEnquiryMailboxStateDocument>,
    @InjectModel(ContactEnquiryInboundReceipt.name)
    private readonly receiptModel: Model<ContactEnquiryInboundReceiptDocument>,
    @InjectModel(ContactEnquiryMessage.name)
    private readonly messageModel: Model<ContactEnquiryMessageDocument>,
    @InjectModel(ContactEnquiry.name)
    private readonly enquiryModel: Model<ContactEnquiryDocument>,
    private readonly gmail: ContactEnquiryGmailService,
    private readonly enquiries: ContactEnquiriesService,
  ) {}

  async ensureWatch(): Promise<void> {
    if (!this.gmail.isEnabled()) return;
    this.gmail.assertConfigured();
    const mailbox = this.gmail.mailbox();
    const state = await this.stateModel.findOneAndUpdate(
      { mailbox },
      { $setOnInsert: { mailbox } },
      { upsert: true, new: true },
    );
    const renewBefore = Date.now() + (2 * 24 * 60 * 60 * 1000);
    if (state.watchExpiration && state.watchExpiration.getTime() > renewBefore) return;
    const watch = await this.gmail.registerWatch();
    const update: Record<string, unknown> = {
      watchExpiration: watch.expiration,
      lastError: null,
    };
    if (!state.historyId) update.historyId = watch.historyId;
    await this.stateModel.updateOne({ mailbox }, { $set: update });
    this.logger.log(`Gmail watch active until ${watch.expiration.toISOString()}`);
  }

  async syncMailbox(): Promise<void> {
    if (!this.gmail.isEnabled()) return;
    const mailbox = this.gmail.mailbox();
    await this.stateModel.updateOne({ mailbox }, { $setOnInsert: { mailbox } }, { upsert: true });
    const leaseOwner = `${process.pid}-${randomBytes(6).toString('hex')}`;
    const now = new Date();
    const state = await this.stateModel.findOneAndUpdate(
      {
        mailbox,
        $or: [
          { leaseUntil: { $exists: false } },
          { leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          leaseOwner,
          leaseUntil: new Date(Date.now() + (10 * 60 * 1000)),
        },
      },
      { new: true },
    );
    if (!state) return;

    try {
      if (!state.historyId) {
        await this.ensureWatch();
        return;
      }
      try {
        const changes = await this.gmail.listHistory(state.historyId);
        for (const messageId of changes.messageIds) await this.processMessage(messageId);
        await this.stateModel.updateOne(
          { mailbox, leaseOwner },
          {
            $set: {
              historyId: changes.historyId,
              lastSyncedAt: new Date(),
              lastError: null,
            },
          },
        );
      } catch (error: any) {
        if (!this.isExpiredHistoryError(error)) throw error;
        await this.recoverExpiredCursor(state.lastSyncedAt);
      }
    } catch (error: any) {
      await this.stateModel.updateOne(
        { mailbox, leaseOwner },
        { $set: { lastError: this.errorMessage(error) } },
      );
      throw error;
    } finally {
      await this.stateModel.updateOne(
        { mailbox, leaseOwner },
        { $unset: { leaseOwner: '', leaseUntil: '' } },
      );
    }
  }

  private async recoverExpiredCursor(lastSyncedAt?: Date): Promise<void> {
    const after = lastSyncedAt && lastSyncedAt.getTime() > Date.now() - (7 * 24 * 60 * 60 * 1000)
      ? new Date(lastSyncedAt.getTime() - (60 * 60 * 1000))
      : new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const messageIds = await this.gmail.listRecentInboxMessageIds(after);
    for (const messageId of messageIds) await this.processMessage(messageId);
    const watch = await this.gmail.registerWatch();
    await this.stateModel.updateOne(
      { mailbox: this.gmail.mailbox() },
      {
        $set: {
          historyId: watch.historyId,
          watchExpiration: watch.expiration,
          lastSyncedAt: new Date(),
          lastRecoveryAt: new Date(),
          lastError: null,
        },
      },
    );
  }

  private async processMessage(messageId: string): Promise<void> {
    const existing = await this.receiptModel.findOne({ providerMessageId: messageId });
    if (existing && [
      ContactInboundReceiptStatus.PROCESSED,
      ContactInboundReceiptStatus.IGNORED,
      ContactInboundReceiptStatus.UNMATCHED,
    ].includes(existing.status)) return;

    const receipt = existing || await this.receiptModel.create({
      providerMessageId: messageId,
      status: ContactInboundReceiptStatus.PROCESSING,
      attempts: 0,
    });
    receipt.status = ContactInboundReceiptStatus.PROCESSING;
    receipt.attempts += 1;
    await receipt.save();

    try {
      const message = await this.gmail.getMessage(messageId);
      Object.assign(receipt, {
        providerThreadId: message.providerThreadId,
        internetMessageId: message.internetMessageId,
        senderEmail: message.senderEmail,
        recipient: message.recipient,
        subject: message.subject,
        receivedAt: message.receivedAt,
      });
      const ignoredReason = this.ignoredReason(message);
      if (ignoredReason) {
        receipt.status = ContactInboundReceiptStatus.IGNORED;
        receipt.reason = ignoredReason;
        receipt.processedAt = new Date();
        await receipt.save();
        return;
      }

      const reference = await this.referenceFor(message);
      if (!reference) {
        receipt.status = ContactInboundReceiptStatus.UNMATCHED;
        receipt.reason = 'No enquiry reference could be established safely';
        receipt.processedAt = new Date();
        await receipt.save();
        return;
      }

      const result = await this.enquiries.recordInboundReply({
        reference,
        providerMessageId: message.providerMessageId,
        providerThreadId: message.providerThreadId,
        internetMessageId: message.internetMessageId,
        inReplyTo: message.inReplyTo,
        references: message.references,
        senderEmail: message.senderEmail!,
        body: message.body,
        receivedAt: message.receivedAt,
      });
      receipt.enquiryId = result.enquiryId ? this.objectId(result.enquiryId) : undefined;
      receipt.status = result.status === 'processed' || result.status === 'duplicate'
        ? ContactInboundReceiptStatus.PROCESSED
        : ContactInboundReceiptStatus.UNMATCHED;
      receipt.reason = result.reason;
      receipt.processedAt = new Date();
      await receipt.save();
    } catch (error: any) {
      receipt.status = ContactInboundReceiptStatus.FAILED;
      receipt.reason = this.errorMessage(error);
      await receipt.save();
      throw error;
    }
  }

  private ignoredReason(message: GmailInboundMessage): string | undefined {
    if (message.automated) return 'Automated email';
    if (!message.senderEmail) return 'Sender email is missing';
    const ownAddresses = [this.gmail.mailbox(), String(process.env.SMTP_USER || '').toLowerCase()];
    if (ownAddresses.includes(message.senderEmail)) return 'Message originated from an ALECONS system mailbox';
    if (!message.body.trim()) return 'Message body is empty';
    return undefined;
  }

  private async referenceFor(message: GmailInboundMessage): Promise<string | undefined> {
    const mailbox = this.gmail.mailbox();
    const separator = mailbox.lastIndexOf('@');
    const localPart = this.escapeRegex(mailbox.slice(0, separator).split('+')[0]);
    const domain = this.escapeRegex(mailbox.slice(separator + 1));
    const taggedAddress = new RegExp(`${localPart}\\+(ENQ-\\d{4}-[A-F0-9]{8})@${domain}`, 'i');
    const addressReference = message.recipient.match(taggedAddress)?.[1];
    if (addressReference) return addressReference.toUpperCase();

    const relatedIds = [...message.references, message.inReplyTo].filter((value): value is string => Boolean(value));
    if (relatedIds.length) {
      const related = await this.messageModel.findOne({ internetMessageId: { $in: relatedIds } })
        .select('enquiryId').lean();
      if (related?.enquiryId) {
        const enquiry = await this.enquiryModel.findById(related.enquiryId).select('reference').lean();
        if (enquiry?.reference) return enquiry.reference;
      }
    }

    return message.subject.match(/\bENQ-\d{4}-[A-F0-9]{8}\b/i)?.[0]?.toUpperCase();
  }

  private objectId(value: string): Types.ObjectId {
    return new Types.ObjectId(value);
  }

  private isExpiredHistoryError(error: any): boolean {
    return Number(error?.code || error?.response?.status) === 404;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private errorMessage(error: any): string {
    return String(error?.response?.data?.error?.message || error?.message || error || 'Unknown inbound Gmail error')
      .slice(0, 1000);
  }
}

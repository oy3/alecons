import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ContentSanitizationService } from './content-sanitization.service';

export type GmailInboundMessage = {
  providerMessageId: string;
  providerThreadId?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references: string[];
  senderEmail?: string;
  recipient: string;
  subject: string;
  body: string;
  receivedAt: Date;
  automated: boolean;
};

@Injectable()
export class ContactEnquiryGmailService {
  private readonly logger = new Logger(ContactEnquiryGmailService.name);
  private oauth2Client: any;
  private gmail: any;

  constructor(private readonly sanitizer: ContentSanitizationService) {}

  isEnabled(): boolean {
    return String(process.env.CONTACT_INBOUND_EMAIL_ENABLED || 'false').toLowerCase() === 'true';
  }

  mailbox(): string {
    return String(process.env.GOOGLE_INBOUND_MAILBOX || '').trim().toLowerCase();
  }

  topic(): string {
    return String(process.env.GOOGLE_GMAIL_PUBSUB_TOPIC || '').trim();
  }

  audience(): string {
    return String(process.env.GOOGLE_GMAIL_PUBSUB_AUDIENCE || '').trim();
  }

  pushServiceAccount(): string {
    return String(process.env.GOOGLE_GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT || '').trim().toLowerCase();
  }

  assertConfigured(): void {
    const required = [
      'GOOGLE_INBOUND_CLIENT_ID',
      'GOOGLE_INBOUND_CLIENT_SECRET',
      'GOOGLE_INBOUND_REFRESH_TOKEN',
      'GOOGLE_INBOUND_MAILBOX',
      'GOOGLE_GMAIL_PUBSUB_TOPIC',
      'GOOGLE_GMAIL_PUBSUB_AUDIENCE',
      'GOOGLE_GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT',
      'CONTACT_REPLY_DOMAIN',
    ];
    const missing = required.filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) throw new Error(`Inbound Gmail configuration is incomplete: ${missing.join(', ')}`);
  }

  assertPushConfigured(): void {
    const required = [
      'GOOGLE_GMAIL_PUBSUB_AUDIENCE',
      'GOOGLE_GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT',
    ];
    const missing = required.filter((name) => !String(process.env[name] || '').trim());
    if (missing.length) throw new Error(`Gmail Pub/Sub authentication is incomplete: ${missing.join(', ')}`);
  }

  async verifyPushToken(idToken: string): Promise<void> {
    this.assertPushConfigured();
    const verifier = new google.auth.OAuth2();
    const ticket = await verifier.verifyIdToken({ idToken, audience: this.audience() });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email?.toLowerCase() !== this.pushServiceAccount()) {
      throw new Error('Pub/Sub token identity does not match the configured push service account');
    }
  }

  async registerWatch(): Promise<{ historyId: string; expiration: Date }> {
    const response = await this.client().users.watch({
      userId: 'me',
      requestBody: {
        topicName: this.topic(),
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include',
      },
    });
    if (!response.data.historyId || !response.data.expiration) {
      throw new Error('Gmail did not return a watch history ID and expiration');
    }
    return {
      historyId: String(response.data.historyId),
      expiration: new Date(Number(response.data.expiration)),
    };
  }

  async listHistory(startHistoryId: string): Promise<{ messageIds: string[]; historyId: string }> {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = startHistoryId;
    do {
      const response = await this.client().users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        labelId: 'INBOX',
        pageToken,
        maxResults: 500,
      });
      for (const history of response.data.history || []) {
        for (const addition of history.messagesAdded || []) {
          if (addition.message?.id) messageIds.add(addition.message.id);
        }
      }
      if (response.data.historyId) latestHistoryId = String(response.data.historyId);
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);
    return { messageIds: [...messageIds], historyId: latestHistoryId };
  }

  async listRecentInboxMessageIds(after: Date): Promise<string[]> {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    const afterSeconds = Math.floor(after.getTime() / 1000);
    do {
      const response = await this.client().users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'],
        q: `after:${afterSeconds}`,
        maxResults: 500,
        pageToken,
      });
      for (const message of response.data.messages || []) {
        if (message.id) ids.add(message.id);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken && ids.size < 2000);
    return [...ids];
  }

  async getMessage(messageId: string): Promise<GmailInboundMessage> {
    const response = await this.client().users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    const message = response.data;
    const headers = new Map<string, string>();
    for (const header of message.payload?.headers || []) {
      if (header.name && header.value) headers.set(header.name.toLowerCase(), header.value);
    }
    const plainParts = this.partBodies(message.payload, 'text/plain');
    const htmlParts = this.partBodies(message.payload, 'text/html');
    const rawBody = plainParts.join('\n').trim()
      || this.sanitizer.extractTextContent(htmlParts.join('\n'));
    const receivedAt = message.internalDate
      ? new Date(Number(message.internalDate))
      : new Date(headers.get('date') || Date.now());
    const references = this.messageIds(headers.get('references'));
    const inReplyTo = this.messageIds(headers.get('in-reply-to'))[0];
    const sender = headers.get('from') || '';
    const autoSubmitted = (headers.get('auto-submitted') || '').toLowerCase();
    const precedence = (headers.get('precedence') || '').toLowerCase();
    const automated = (autoSubmitted && autoSubmitted !== 'no')
      || ['bulk', 'junk', 'list'].includes(precedence)
      || headers.has('x-autoreply')
      || headers.has('x-autorespond')
      || /mailer-daemon|postmaster/i.test(sender);
    return {
      providerMessageId: String(message.id),
      providerThreadId: message.threadId || undefined,
      internetMessageId: headers.get('message-id'),
      inReplyTo,
      references,
      senderEmail: this.emailAddress(sender),
      recipient: [headers.get('to'), headers.get('delivered-to'), headers.get('x-original-to')]
        .filter(Boolean)
        .join(', '),
      subject: headers.get('subject') || '',
      body: this.trimQuotedReply(rawBody).slice(0, 12000),
      receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
      automated: Boolean(automated),
    };
  }

  private client(): any {
    if (this.gmail) return this.gmail;
    this.assertConfigured();
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_INBOUND_CLIENT_ID,
      process.env.GOOGLE_INBOUND_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground',
    );
    this.oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_INBOUND_REFRESH_TOKEN });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    this.logger.log(`Inbound Gmail client configured for ${this.mailbox()}`);
    return this.gmail;
  }

  private partBodies(part: any, mimeType: string): string[] {
    if (!part) return [];
    const bodies: string[] = [];
    if (part.mimeType === mimeType && part.body?.data) {
      bodies.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
    }
    for (const child of part.parts || []) bodies.push(...this.partBodies(child, mimeType));
    return bodies;
  }

  private emailAddress(value: string): string | undefined {
    const matches = value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return matches?.[0]?.toLowerCase();
  }

  private messageIds(value?: string): string[] {
    if (!value) return [];
    const ids = value.match(/<[^<>\s]+>/g) || [];
    return [...new Set(ids)];
  }

  private trimQuotedReply(value: string): string {
    const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
    const kept: string[] = [];
    for (const line of lines) {
      if (/^\s*>/.test(line)) continue;
      if (/^\s*-{2,}\s*original message\s*-{2,}\s*$/i.test(line)) break;
      if (/^\s*on .+ wrote:\s*$/i.test(line)) break;
      kept.push(line);
    }
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
}

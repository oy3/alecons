import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GmailPubSubWebhookController } from '../src/controllers/gmail-pubsub-webhook.controller';
import { GmailPubSubAuthGuard } from '../src/guards/gmail-pubsub-auth.guard';
import { ContactEnquiryGmailService } from '../src/services/contact-enquiry-gmail.service';
import { ContactEnquiryInboundService } from '../src/services/contact-enquiry-inbound.service';

function requestContext(authorization?: string): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  };
}

test('the Gmail Pub/Sub guard requires and verifies a bearer identity token', async () => {
  let token = '';
  const guard = new GmailPubSubAuthGuard({
    isEnabled: () => true,
    verifyPushToken: async (value: string) => { token = value; },
  } as any);
  await assert.rejects(() => guard.canActivate(requestContext()), UnauthorizedException);
  assert.equal(await guard.canActivate(requestContext('Bearer signed-token')), true);
  assert.equal(token, 'signed-token');
});

test('the webhook accepts only a notification for the configured mailbox', async () => {
  const jobs: any[] = [];
  const controller = new GmailPubSubWebhookController(
    { isEnabled: () => true, mailbox: () => 'enquiries@alecons.edu.ng' } as any,
    { enqueue: async (job: any) => jobs.push(job) } as any,
  );
  const data = Buffer.from(JSON.stringify({
    emailAddress: 'enquiries@alecons.edu.ng',
    historyId: '123456',
  })).toString('base64');
  await controller.receive({ message: { messageId: 'pubsub-1', data } });
  assert.deepEqual(jobs, [{
    pubsubMessageId: 'pubsub-1',
    emailAddress: 'enquiries@alecons.edu.ng',
    historyId: '123456',
  }]);

  const otherMailbox = Buffer.from(JSON.stringify({
    emailAddress: 'other@alecons.edu.ng',
    historyId: '123456',
  })).toString('base64');
  await assert.rejects(
    () => controller.receive({ message: { messageId: 'pubsub-2', data: otherMailbox } }),
    BadRequestException,
  );
});

test('the webhook acknowledges without queueing while ingestion is disabled', async () => {
  let queued = false;
  const controller = new GmailPubSubWebhookController(
    { isEnabled: () => false } as any,
    { enqueue: async () => { queued = true; } } as any,
  );
  await controller.receive({});
  assert.equal(queued, false);
});

test('Gmail parsing keeps the new plain-text reply and removes quoted history', async () => {
  const gmail = new ContactEnquiryGmailService({ extractTextContent: (value: string) => value } as any);
  (gmail as any).gmail = {
    users: {
      messages: {
        get: async () => ({
          data: {
            id: 'gmail-1',
            threadId: 'thread-1',
            internalDate: String(new Date('2026-09-02T11:15:00Z').getTime()),
            payload: {
              mimeType: 'text/plain',
              headers: [
                { name: 'From', value: 'Enquirer <person@example.com>' },
                { name: 'To', value: 'enquiries+ENQ-2026-ABCDEF12@alecons.edu.ng' },
                { name: 'Subject', value: 'Re: ALECONS enquiry ENQ-2026-ABCDEF12' },
                { name: 'Message-ID', value: '<reply@example.com>' },
                { name: 'In-Reply-To', value: '<original@alecons.edu.ng>' },
              ],
              body: {
                data: Buffer.from('Thank you for the update.\n\nOn Tue, ALECONS wrote:\n> Earlier text')
                  .toString('base64url'),
              },
            },
          },
        }),
      },
    },
  };

  const message = await gmail.getMessage('gmail-1');
  assert.equal(message.senderEmail, 'person@example.com');
  assert.equal(message.body, 'Thank you for the update.');
  assert.equal(message.inReplyTo, '<original@alecons.edu.ng>');
  assert.equal(message.automated, false);
});

test('inbound correlation gives the tagged reply address priority', async () => {
  const inbound = new ContactEnquiryInboundService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { mailbox: () => 'enquiries@alecons.edu.ng' } as any,
    {} as any,
  );
  const reference = await (inbound as any).referenceFor({
    recipient: 'ALECONS <enquiries+enq-2026-abcdef12@alecons.edu.ng>',
    references: [],
    subject: 'A reply without a reference in its subject',
  });
  assert.equal(reference, 'ENQ-2026-ABCDEF12');
});

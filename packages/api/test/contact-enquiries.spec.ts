import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { ContactEnquiriesService } from '../src/services/contact-enquiries.service';

function service(access: any = {}) {
  return new ContactEnquiriesService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      hasGlobalQueue: (context: any) => Boolean(context.globalQueue),
      ...access,
    } as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

test('ordinary enquiry responders are always restricted to their assigned records', () => {
  const enquiries = service();
  const actorId = new Types.ObjectId();
  const filter = (enquiries as any).accessFilter({ actorId, globalQueue: false }, 'all');
  assert.equal(String(filter.assignedToUserId), String(actorId));
});

test('assignment staff can switch between the institution queue, their queue and unassigned enquiries', () => {
  const enquiries = service();
  const actorId = new Types.ObjectId();
  const context = { actorId, globalQueue: true };
  assert.deepEqual((enquiries as any).accessFilter(context, 'all'), {});
  assert.equal(String((enquiries as any).accessFilter(context, 'mine').assignedToUserId), String(actorId));
  assert.deepEqual((enquiries as any).accessFilter(context, 'unassigned'), { assignedToUserId: { $exists: false } });
});

test('the public honeypot returns a generic receipt without persisting or sending mail', async () => {
  const enquiries = service();
  const result = await enquiries.createPublic({
    firstName: 'Bot',
    lastName: 'Submission',
    email: 'bot@example.com',
    category: 'general' as any,
    message: 'This otherwise looks like a valid public enquiry.',
    website: 'https://spam.example',
  });
  assert.equal(result.received, true);
  assert.match(result.reference, /^ENQ-\d{4}-[A-F0-9]{8}$/);
});

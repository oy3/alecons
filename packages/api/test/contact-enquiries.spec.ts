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

test('the first responding staff member atomically owns an unassigned enquiry', async () => {
  const actorId = new Types.ObjectId();
  const enquiryId = new Types.ObjectId();
  const enquiry: any = {
    _id: enquiryId,
    status: 'new',
    assignedToUserId: undefined,
  };
  const assigned = {
    ...enquiry,
    status: 'assigned',
    assignedToUserId: actorId,
  };
  let assignmentFilter: any;
  let activity: any;
  const enquiries = new ContactEnquiriesService(
    {
      findOneAndUpdate: async (filter: any) => {
        assignmentFilter = filter;
        return assigned;
      },
    } as any,
    { create: async () => ({ _id: new Types.ObjectId() }) } as any,
    { create: async (value: any) => { activity = value; } } as any,
    {} as any,
    {} as any,
    {} as any,
    {
      assertPermission: async () => ({ actorId }),
    } as any,
    {} as any,
    {} as any,
    {} as any,
  );
  (enquiries as any).findAccessible = async () => enquiry;
  (enquiries as any).deliverResponse = async (_context: any, owner: any) => owner;

  const result: any = await enquiries.respond(String(actorId), String(enquiryId), { body: 'A response' });
  assert.equal(String(result.assignedToUserId), String(actorId));
  assert.equal(String(assignmentFilter._id), String(enquiryId));
  assert.equal(activity.action, 'auto_assigned_on_response');
});

test('responding never silently replaces an existing assignee', async () => {
  const actorId = new Types.ObjectId();
  const existingAssignee = new Types.ObjectId();
  const enquiry: any = {
    _id: new Types.ObjectId(),
    status: 'assigned',
    assignedToUserId: existingAssignee,
  };
  let attemptedAssignment = false;
  const enquiries = new ContactEnquiriesService(
    { findOneAndUpdate: async () => { attemptedAssignment = true; } } as any,
    { create: async () => ({ _id: new Types.ObjectId() }) } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { assertPermission: async () => ({ actorId }) } as any,
    {} as any,
    {} as any,
    {} as any,
  );
  (enquiries as any).findAccessible = async () => enquiry;
  (enquiries as any).deliverResponse = async (_context: any, owner: any) => owner;

  const result: any = await enquiries.respond(String(actorId), String(enquiry._id), { body: 'A response' });
  assert.equal(attemptedAssignment, false);
  assert.equal(String(result.assignedToUserId), String(existingAssignee));
});

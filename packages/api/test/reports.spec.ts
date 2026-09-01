import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { ReportExportService } from '../src/services/report-export.service';
import { ReportsService } from '../src/services/reports.service';
import { ScheduledReportsService } from '../src/services/scheduled-reports.service';
import { PortalActivityService } from '../src/services/portal-activity.service';

test('report percentages are deterministic and protect division by zero', () => {
  const reports = Object.create(ReportsService.prototype) as any;
  assert.equal(reports.percent(7, 10), 70);
  assert.equal(reports.percent(2, 3), 66.7);
  assert.equal(reports.percent(5, 0), 0);
});

test('report comparison returns percentage changes without inventing a zero baseline', () => {
  const reports = Object.create(ReportsService.prototype) as any;
  assert.deepEqual(reports.kpiChanges(
    { applications: 120, students: 10, revenue: 20 },
    { applications: 100, students: 0, revenue: 40 },
  ), { applications: 20, students: null, revenue: -50 });
});

test('spreadsheet exports neutralize formula-like cells', () => {
  const exports = Object.create(ReportExportService.prototype) as any;
  const [row] = exports.safeRows([{ name: '=HYPERLINK("bad")', safe: 'ALECONS', amount: -50 }]);
  assert.equal(row.name, "'=HYPERLINK(\"bad\")");
  assert.equal(row.safe, 'ALECONS');
  assert.equal(row.amount, -50);
});

test('weekly report scheduling always produces a future run', () => {
  const schedules = Object.create(ScheduledReportsService.prototype) as any;
  const next = schedules.nextRun({ frequency: 'weekly', time: '08:00', dayOfWeek: new Date().getDay() });
  assert.ok(next instanceof Date);
  assert.ok(next.getTime() > Date.now());
});

test('monthly report scheduling is capped to a safe calendar day', () => {
  const schedules = Object.create(ScheduledReportsService.prototype) as any;
  const next = schedules.nextRun({ frequency: 'monthly', time: '08:00', dayOfMonth: 28 });
  assert.equal(next.getDate(), 28);
  assert.equal(next.getUTCHours(), 7, '08:00 Africa/Lagos must be stored as 07:00 UTC');
  assert.ok(next.getTime() > Date.now());
});

test('portal activity stores only route templates and expires after retention period', async () => {
  let created: any;
  const activity = new PortalActivityService({ create: async (value: any) => { created = value; } } as any);
  const userId = new Types.ObjectId();
  await activity.record({ _id: userId, role: 'student' }, {
    portal: 'student', eventType: 'page_view', routeName: 'Academics', pathTemplate: '/academics',
  });
  assert.equal(String(created.userId), String(userId));
  assert.equal(created.routeName, 'Academics');
  assert.equal(created.pathTemplate, '/academics');
  assert.ok(created.expiresAt.getTime() > created.occurredAt.getTime());
});

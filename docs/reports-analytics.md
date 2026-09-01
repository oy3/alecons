# Reports & Analytics

The staff Reports & Analytics module provides institution-wide and ownership-scoped reporting for admissions, students, finance, academic results, examinations, notifications, authenticated portal activity, and public website traffic.

## Access setup

Add the `reports` module to each permitted staff role. `Manage All` grants every report capability and institution-wide scope.

- `View Overview`: cross-domain overview.
- `View Admissions`, `View Students`, `View Finance`, `View Academics`, `View Exams`, `View Communications`, `View Activity & Website`: domain tabs.
- `Export`: CSV, Excel, PDF, personal export history, and personal scheduled reports.
- `Manage All`: all tabs, all organizational data, all schedule/audit records, and fee-obligation synchronization.

HODs, course advisers, and lecturers without `Manage All` are restricted to their assigned departments, programs, and program courses where the underlying report supports academic ownership. Other explicitly authorized operational report roles retain institution-wide access for their permitted domain.

## Production rollout

1. Deploy the API and staff, student, and application portal builds together so portal activity collection and reporting endpoints arrive together.
2. Assign `reports` permissions in Roles Management. Existing roles are not modified automatically.
3. Open **Utilities** as an administrator or a role with `Utilities: Manage All`, then run **Backfill Student Fee Obligations** once. The operation is idempotent and reconciles successful payments.
4. Review the Finance report for each academic session before relying on expected and outstanding revenue.
5. Create a test scheduled report to an internal address, verify its attachment, then disable or retain it.

The nightly job synchronizes fee obligations for open and ongoing sessions at 01:30 Africa/Lagos time. Report snapshots expire after ten minutes. Authenticated portal activity expires after thirteen months.

## Umami configuration

Website analytics are optional. Configure these in the GitHub `production` environment:

- Variable `UMAMI_API_URL`, normally `https://api.umami.is/v1` for Umami Cloud or the base URL of a self-hosted instance.
- Secret `UMAMI_API_TOKEN` with read access to the website.
- Variable `UMAMI_WEBSITE_ID` for the ALECONS website.

If these values are absent, internal reports continue to work and the Activity tab clearly shows that website analytics are not configured. The token is read only by the API and is never sent to a browser.

## Data added by this module

- `reportexports`: immutable export audit records.
- `reportsnapshots`: short-lived cached report payloads with TTL cleanup.
- `scheduledreports`: governed email schedules and run status.
- `portalactivityevents`: privacy-conscious authenticated route events with TTL cleanup.
- `studentfeeobligations`: session/payment amount snapshots used for expected and outstanding student revenue.

Student fee obligations preserve the configured amount at creation. Future fee edits do not silently rewrite historical expectations.

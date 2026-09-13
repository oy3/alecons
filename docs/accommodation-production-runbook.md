# Accommodation Production Runbook

This release performs a deliberate, one-way application rename from
`StudentPayment` to `PaymentTransaction`. The production deploy script renames
the MongoDB collection from `studentpayments` to `paymenttransactions` while
the API is stopped. Do not deploy this release without a current database backup.

## Before merging to `production`

1. Confirm the `development` deployment has passed API, staff portal, student
   portal, application portal, CBT, and website smoke tests.
2. Back up the production MongoDB database and verify the backup is readable.
   For a self-managed MongoDB deployment, run this from a protected host where
   `DATABASE_URL` is already available:

   ```bash
   mkdir -p "$HOME/backups/alecons"
   mongodump \
     --uri "$DATABASE_URL" \
     --archive="$HOME/backups/alecons/pre-accommodation-$(date +%Y%m%d-%H%M%S).archive" \
     --gzip
   ```

   Use the managed provider's on-demand snapshot instead when production uses
   a managed MongoDB service.
3. Confirm there is not already an unexpected `paymenttransactions` collection.
   The migration refuses to continue if both `studentpayments` and
   `paymenttransactions` exist.
4. Confirm the production GitHub Environment still requires an authorized
   reviewer. Approve the deployment only after steps 1-3 are complete.
5. Do not process payments during the deployment window. The deploy script
   stops the API before renaming the collection and restarts it after both
   migrations finish.

## Automated deployment behavior

On a push to `production`, `.github/workflows/deploy-production.yml` builds all
applications and invokes `scripts/deploy/remote-deploy.sh`. The remote script:

1. Stages the new frontend and API artifacts.
2. Runs the payment migration in dry-run mode.
3. Stops the API.
4. Renames `studentpayments` to `paymenttransactions` and backfills payer
   classification fields.
5. Backfills session-scoped accommodation applications for existing tenancy
   agreements, installs resident-scoped tenancy indexes, moves unsigned
   external drafts to the agreement step, and removes the obsolete assignment
   index.
6. Starts the new API and performs its health check.
7. Restores the old payment collection and previous API release automatically
   if the first deployment fails its migration or health check.

Later deployments are idempotent: the migration detects that
`paymenttransactions` already exists and only backfills missing classification
fields.

## Production configuration

Set `ACCOMMODATION_HOSTEL_ADDRESS` for the legal hostel address printed on
internal and external tenancy agreements. This value is required; the API does
not substitute a frontend setting or a general school address. Tenancy start
and end dates are always read from the selected academic session in the API.

For local development, place it in `packages/api/.env.development`. For
production, add it as a variable in the GitHub `production` Environment; the
deployment workflow writes it into the API's generated `.env.production`.

External residents accept the agreement before payment. The API stores that
acceptance immediately for audit purposes, but generates and releases the
tenancy-agreement PDF and allocation slip only after payment has been verified
and a bed has been allocated. Both private files are stored under
`external-residents/<external-resident-number>/documents/`; the accommodation
application number is retained in their object metadata for traceability.

In **Academics Management > Payments**, create or confirm these payment records:

- Internal accommodation fee: audience `Student`.
- External accommodation fee: audience `External resident` and a distinct
  payment code such as `externalAccommodationFee`.

In **Payment Destination Accounts**, configure:

- Internal accommodation Paystack destination: the nursing accommodation
  subaccount code.
- External accommodation Paystack destination: the arts and sciences
  subaccount code.
- Optional manual-transfer destinations for either flow, using their correct
  account name, bank, and account number.

For each Paystack destination, enter its `ACCT_...` subaccount code. Leave the
flat transaction charge empty or zero when the Paystack subaccount should
receive 100% of the transaction split. The API sends the subaccount and does
not invent a percentage or platform charge.

In **Academic Sessions > Session Controls > Accommodation**:

1. Select the internal and external accommodation payment records.
2. Set the application window.
3. Open internal and/or external applications only after inventory exists.
4. Save and re-open the control to confirm the selected payment mappings.

In **Accommodation Management**:

1. Create male and female hostels.
2. Create blocks and mark each block for internal or external residents.
3. Create rooms with the correct capacity and allocation order.
4. Keep incomplete inventory inactive until it is ready for allocation.

Grant staff only the required `accommodation` permissions: `view`, `configure`,
and/or `allocate`. Administrators retain full access.

## Post-deployment checks

1. Check `https://api.alecons.edu.ng/api/v1/health` and all portal home pages.
2. Confirm historical payments appear in staff Payments Management and a known
   student can see their payment history.
3. Test one internal flow: sign the session agreement, initialize payment in
   test/manual mode, approve it, and confirm allocation plus the executed
   agreement.
4. Test one external flow with a fresh email: verify email, resume the draft,
   submit profile/details, accept the tenancy agreement, pay or submit a
   receipt, confirm allocation, and download both the allocation slip and
   finalized tenancy agreement from the allocation stage.
5. Confirm an existing non-external ALECONS email is rejected by the external
   form.
6. Confirm an external Paystack payment fails closed if its subaccount code is
   invalid.
7. Verify a full room places a paid application in
   `paid_awaiting_allocation`, and that **Retry allocations** succeeds after a
   matching bed is made available.
8. Inspect the accommodation audit trail and the payment destination snapshot
   on the transaction.

## Manual emergency rollback

The deployment script handles failure during the initial rollout. If a manual
rollback is required before any new production payments are accepted:

```bash
cd /path/to/the/new/api/release
NODE_ENV=production node dist/scripts/migrate-payment-transactions.js --rollback
```

Then point the API symlink back to the previous release and restart its PM2
process. Do not use this rollback after new `PaymentTransaction` records have
been accepted without first reconciling those records and taking another
backup.

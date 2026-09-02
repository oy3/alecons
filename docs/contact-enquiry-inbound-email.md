# Contact Enquiry Inbound Email

## Purpose

Replies to contact-enquiry emails sent to tagged addresses such as
`enquiries+ENQ-2026-XXXXXXXX@alecons.edu.ng` are ingested into the existing
staff Contact Enquiries conversation. Gmail Pub/Sub is only a change signal;
the API reads the mailbox through a separate OAuth client with the
`gmail.readonly` scope.

The integration provides:

- Google-signed OIDC authentication on the Pub/Sub push endpoint.
- Durable Gmail history cursor and watch-expiration storage.
- A Bull queue with retries so the webhook responds quickly.
- Provider-message idempotency and an inbound processing receipt.
- Tagged-address, RFC message-header, and subject correlation in that order.
- Exact sender-email validation against the original enquiry.
- Automatic workflow reopening and staff notifications.
- Daily Gmail watch renewal and a 15-minute recovery sync.

## GitHub Production Environment

Add these **environment secrets** to the `production` GitHub environment:

- `GOOGLE_INBOUND_CLIENT_ID`
- `GOOGLE_INBOUND_CLIENT_SECRET`
- `GOOGLE_INBOUND_REFRESH_TOKEN`

Add these **environment variables**:

```text
CONTACT_INBOUND_EMAIL_ENABLED=false
GOOGLE_INBOUND_MAILBOX=enquiries@alecons.edu.ng
GOOGLE_GMAIL_PUBSUB_TOPIC=projects/api-mailer-01/topics/alecons-contact-enquiries-inbound
GOOGLE_GMAIL_PUBSUB_AUDIENCE=https://api.alecons.edu.ng/api/v1/webhooks/google/gmail
GOOGLE_GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT=alecons-contact-enquiries-push@api-mailer-01.iam.gserviceaccount.com
CONTACT_REPLY_DOMAIN=alecons.edu.ng
```

The outbound `GOOGLE_CLIENT_*` credentials remain separate and continue to
send email as the configured `SMTP_USER`. Never replace those values with the
read-only inbound token.

## Production Rollout

1. Add all production secrets and variables above with the feature flag set to
   `false`.
2. Merge the feature branch through the repository's normal review path into
   `production`. The production workflow builds, renders the API environment,
   deploys, and restarts the API.
3. Confirm the endpoint exists and rejects an unauthenticated request:

   ```bash
   curl -i -X POST https://api.alecons.edu.ng/api/v1/webhooks/google/gmail \
     -H 'Content-Type: application/json' \
     --data '{}'
   ```

   The expected response is `401 Unauthorized` because only authenticated
   Pub/Sub pushes are accepted.
4. Confirm the API and existing portals are healthy, then change
   `CONTACT_INBOUND_EMAIL_ENABLED` to `true` in the production environment.
5. Re-run the `Deploy Production` workflow. On startup, the API registers the
   Gmail watch and logs its expiration time.
6. Submit a new website enquiry using an email address you control. Confirm the
   acknowledgement arrives and its Reply-To address contains that enquiry's
   reference.
7. Reply from the same enquirer address. Confirm the reply appears once in the
   staff conversation with `Received by email`, the enquiry moves to
   `In progress` when appropriate, and the assignee (or enquiry managers for an
   unassigned enquiry) receives a notification.
8. Reply again after a staff response to confirm the full thread continues.
   Also confirm that replying from a different address does not attach a
   message to the enquiry.

## Operational Checks

The API creates these operational MongoDB collections automatically:

- `contactenquirymailboxstates`: Gmail cursor, watch expiry, lease, and last error.
- `contactenquiryinboundreceipts`: per-message processing and deduplication status.

After activation, verify the mailbox-state record has `historyId`,
`watchExpiration`, and a recent `lastSyncedAt`. Failed or unmatched receipts are
retained for diagnosis; they are never silently attached to an enquiry.

To pause ingestion without producing a Pub/Sub retry storm, set
`CONTACT_INBOUND_EMAIL_ENABLED=false` and deploy again. Authenticated pushes are
then acknowledged without being queued, and no new watch is registered.

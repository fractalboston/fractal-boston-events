# SES bounce and complaint handling

This app records permanent bounces and complaints so those addresses are not emailed again. Amazon SES publishes those events to an SNS topic; SNS posts them to `POST /api/webhooks/ses`. The webhook verifies the SNS signature and the topic ARN, then sets the matching subscriber status to `bounced` or `complained` (email match is case-insensitive). Transient bounces are logged and ignored.

These steps are done in the AWS console after this code is deployed. They do not change the IAM user used for sending; `ses:SendEmail` is still the only sending permission required.

## Environment variables

Set these in Vercel (Production, and Preview if you will subscribe a preview URL):

| Variable | Example | Purpose |
| --- | --- | --- |
| `SES_SNS_TOPIC_ARN` | `arn:aws:sns:us-east-1:123456789012:fractal-ses-events` | Webhook rejects any notification whose `TopicArn` does not match. Leave unset and the endpoint returns 403. |
| `SES_CONFIGURATION_SET` | `my-first-configuration-set` | Attached as `ConfigurationSetName` on every SES v2 send. Required for events from `events@fractal.boston`, which has no default configuration set. The `fractal.boston` domain identity already uses `my-first-configuration-set` as its default. |

Redeploy after saving the variables so the running app can see them.

## AWS console steps (us-east-1)

Use the same region as SES (`us-east-1`).

### 1. Deploy this code first

The HTTPS subscription will fail to confirm unless `POST /api/webhooks/ses` is live and `SES_SNS_TOPIC_ARN` is already set to the topic you are about to create. You can create the topic and add the Vercel variable, deploy, then add the subscription.

The webhook host is the **API** (this Vercel app), not the `https://fractal.boston` static site. Production is documented in `API.md` as `https://fractal-boston-events.vercel.app` (the examples also mention `https://fb-events.vercel.app` — use whichever host actually serves `/api/subscribe` today). The subscription endpoint is:

```
https://fractal-boston-events.vercel.app/api/webhooks/ses
```

### 2. Create an SNS topic

1. Open the [Amazon SNS console](https://console.aws.amazon.com/sns/v3/home?region=us-east-1).
2. Confirm the region is **US East (N. Virginia)**.
3. Go to **Topics** → **Create topic**.
4. Type: **Standard**.
5. Name: `fractal-ses-events` (any name is fine).
6. Leave encryption off unless you have a specific KMS plan; a customer-managed key would require extra decrypt permissions that this webhook does not use.
7. Create the topic.
8. Copy the **ARN**. It looks like `arn:aws:sns:us-east-1:<account-id>:fractal-ses-events`.
9. In Vercel → Project → **Settings** → **Environment Variables**, add `SES_SNS_TOPIC_ARN` with that ARN and `SES_CONFIGURATION_SET` with `my-first-configuration-set` (or the config set name you use). Apply to Production.
10. Redeploy the production app so those values are present before the next step.

### 3. Subscribe the webhook with HTTPS

1. Open the topic → **Create subscription**.
2. Protocol: **HTTPS**.
3. Endpoint: `https://fractal-boston-events.vercel.app/api/webhooks/ses`.
4. Enable **Enable raw message delivery**? **No** — leave it disabled. The webhook expects the SNS envelope (`Type`, `SigningCertURL`, `Signature`, `Message`, …) and reads the SES event from `Message`.
5. Create the subscription.
6. SNS immediately POSTs a `SubscriptionConfirmation` to the endpoint. The app verifies the signature, checks that `SubscribeURL` is an `https://sns.<region>.amazonaws.com/…` URL, and GETs it to confirm.
7. Refresh the subscription. Status should become **Confirmed**. If it stays **Pending confirmation**, check Vercel logs for 403 (missing or wrong `SES_SNS_TOPIC_ARN`, or signature failure) or 500 (the confirm GET failed). You can also use **Request confirmation** on the subscription to retry.

### 4. Send Bounce and Complaint events from the configuration set

The account already has a configuration set named `my-first-configuration-set`. It currently has no event destinations.

1. Open the [SES console](https://console.aws.amazon.com/ses/home?region=us-east-1) → **Configuration sets** → `my-first-configuration-set`.
2. Go to **Event destinations** → **Add destination**.
3. Event types: check **Hard bounces** and **Complaints**. (Optional: you can also enable deliveries or rejects; the webhook ignores event types other than bounce and complaint.)
4. Destination type: **Amazon SNS**.
5. Name: `bounce-complaint-sns` (any name is fine).
6. SNS topic: the `fractal-ses-events` topic from step 2.
7. Add the destination.

You do not need to change identity notification settings (the older bounce/complaint email forwarding). Event destinations on the configuration set are what this webhook uses.

### 5. Confirm events@ mail is covered

Sends from `events@fractal.boston` only inherit a configuration set if the identity has a default one or the send API sets `ConfigurationSetName`. The domain identity already defaults to `my-first-configuration-set`; the email identity does not. This app now sets `ConfigurationSetName` from `SES_CONFIGURATION_SET` on every send, so events@ mail is included once that variable is set.

## How the app applies events

- **Permanent bounce** → subscriber `status` becomes `bounced`.
- **Complaint** → `complained`. A later bounce will not overwrite a complaint.
- **Transient bounce** → logged, status unchanged.
- Addresses are lowercased before lookup. Unknown emails are ignored.
- Weekly, new-event, and broadcast sends already query only `verified` (and, for some tagged broadcasts, `pending`) subscribers, so `bounced` and `complained` are excluded. Welcome and verification emails can still go to a person who is explicitly resubscribing; that is a double opt-in path, not a list blast.
- SES account-level suppression continues to operate independently of these app statuses.

## Optional check

After deploy, SES mailbox simulator addresses can confirm the pipeline: send a one-off test (when you are ready to send mail) to `bounce@simulator.amazonses.com` and `complaint@simulator.amazonses.com`, then confirm a log line or Discord notice and the matching subscriber status if those addresses exist in the database. Do not use this as a load test.

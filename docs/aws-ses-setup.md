# AWS SES Setup Guide

## Step 1: Create IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Navigate to **Users** → **Create user**
3. Enter username: `fractal-events-ses`
4. Select **"Provide access to AWS services and resources"**
5. Choose **"Attach policies directly"**
6. Search for and select: **`AmazonSESFullAccess`**
   - Alternatively, create a custom policy with only sending permissions (see below)
7. Click **Next** → **Create user**

## Step 2: Create Access Keys

1. Click on the newly created user
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Select **"Application running outside AWS"**
5. Click **Next** → **Create access key**
6. **IMPORTANT**: Copy both values immediately:
   - **Access key ID**
   - **Secret access key** (only shown once!)

7. Add these to your `.env` file:
   ```bash
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ```

## Step 3: Verify Domain in SES

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Navigate to **Verified identities** → **Create identity**
3. Select **Domain**
4. Enter domain: `fractal.boston`
5. Click **Create identity**
6. AWS will provide DNS records to add:
   - **DKIM records** (3 CNAME records)
   - **SPF record** (TXT record)
   - **DMARC record** (TXT record - optional but recommended)
7. Add these records to your DNS provider (wherever `fractal.boston` DNS is managed)
8. Wait for verification (usually takes a few minutes)

## Step 4: Request Production Access (Required)

**Important**: New AWS SES accounts start in **sandbox mode**, which means you can only send emails to verified email addresses.

To send to any email address:

1. Go to [SES Console](https://console.aws.amazon.com/ses/)
2. Click **Account dashboard** (left sidebar)
3. Scroll to **"Sending statistics"** section
4. Click **"Request production access"**
5. Fill out the form:
   - **Mail Type**: Select "Transactional"
   - **Website URL**: `https://fractal.boston`
   - **Use case description**: 
     ```
     Sending weekly event notifications and verification emails to subscribers 
     who have opted in via our website. All emails include unsubscribe links 
     and we use double opt-in verification.
     ```
   - **Expected sending volume**: Estimate your monthly volume
   - **Compliance**: Check boxes confirming you'll follow AWS policies
6. Submit the request
7. AWS typically approves within 24 hours

## Custom IAM Policy (Optional - More Secure)

If you want to limit permissions to only what's needed, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

1. Go to IAM → **Policies** → **Create policy**
2. Select **JSON** tab
3. Paste the policy above
4. Name it: `FractalEventsSESPolicy`
5. Attach it to your IAM user instead of `AmazonSESFullAccess`

## Testing

After setup, test your configuration:

```bash
# Set environment variables
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_REGION=us-east-1
export EMAIL_ENABLED=true

# Run test email script
pnpm email:test your-email@example.com
```

## Troubleshooting

### "Email address is not verified"
- Your account is in sandbox mode
- Request production access (Step 4 above)
- Or verify the recipient email address in SES Console

### "Access Denied" errors
- Check IAM user has correct permissions
- Verify access keys are correct
- Ensure region matches where SES is configured

### Domain verification fails
- Check DNS records are correctly added
- Wait a few minutes for DNS propagation
- Verify records match exactly what AWS provided

## Pricing

- **$0.10 per 1,000 emails** sent
- **$0.12 per 1,000 emails** received (if using SES for receiving)
- First 62,000 emails/month are **free** if sending from EC2 instances
- No monthly fees or commitments

## Resources

- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [SES Sending Authorization](https://docs.aws.amazon.com/ses/latest/dg/sending-authorization.html)
- [SES Best Practices](https://docs.aws.amazon.com/ses/latest/dg/best-practices.html)

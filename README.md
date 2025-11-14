# WhatsApp Webhook Handler

A serverless webhook handler for WhatsApp Business API, designed to be deployed on Vercel.

## Features

- ✅ Webhook verification (GET endpoint)
- ✅ Event handling (POST endpoint)
- ✅ Message notifications
- ✅ Delivery status updates
- ✅ Read receipt notifications
- ✅ Incoming message handling
- ✅ Webhook display dashboard (optional)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# WhatsApp Webhook Configuration
WEBHOOK_VERIFY_TOKEN=your_verify_token_here
```

**Important:** The `WEBHOOK_VERIFY_TOKEN` is a token **you create yourself** (not provided by WhatsApp). It's used to verify that webhook requests are coming from Meta/WhatsApp.

#### How to Generate a Secure Token

You can generate a secure random token using any of these methods:

**Option 1: Using Node.js (recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 2: Using OpenSSL**
```bash
openssl rand -hex 32
```

**Option 3: Using an online generator**
- Visit https://randomkeygen.com/ and use a "CodeIgniter Encryption Keys" or similar
- Or use any secure random string generator

**Option 4: Manual (for testing only)**
- Use any random string like `my_secure_webhook_token_2024`

#### Where to Use This Token

1. **In your `.env.local` file** (as shown above)
2. **In Meta App Dashboard** when configuring the webhook:
   - Go to Meta App Dashboard → WhatsApp → Configuration → Webhooks
   - When setting up the webhook, you'll be asked for a "Verify Token"
   - Enter the **same token** you put in `WEBHOOK_VERIFY_TOKEN`

The token must match in both places for webhook verification to work!

### 3. Local Development

Run the development server:

```bash
npm run dev
```

The webhook will be available at `http://localhost:3000/api/webhook`

### 4. Deploy to Vercel

#### Option A: Using Vercel CLI

1. Install Vercel CLI (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

#### Option B: Using Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in [Vercel Dashboard](https://vercel.com/dashboard)
3. Add environment variables in the Vercel project settings:
   - `WEBHOOK_VERIFY_TOKEN`: Your webhook verification token

### 5. Configure Webhook in Meta

1. Go to your Meta App Dashboard
2. Navigate to WhatsApp > Configuration > Webhooks
3. Click "Edit" on the Webhook URL field
4. Enter your Vercel deployment URL: `https://your-project.vercel.app/api/webhook`
5. Set the Verify Token to match your `WEBHOOK_VERIFY_TOKEN` environment variable
6. Subscribe to the following webhook fields:
   - `messages`
   - `message_deliveries`
   - `message_reads`
   - `message_echoes` (optional)

## Webhook Events

The webhook handles the following events:

### Message Events
- **Incoming Messages**: Text, media, and other message types
- **Message Echoes**: Messages sent from your app (for confirmation)

### Status Events
- **Sent**: Message was sent successfully
- **Delivered**: Message was delivered to the recipient
- **Read**: Message was read by the recipient

## Testing

After deploying:

1. Send a template message from your WhatsApp Business API
2. Reply to the message
3. Check your Vercel function logs to see the webhook notifications

You should see 4 separate webhook notifications:
1. Message send notification
2. Message delivered notification
3. Message read notification
4. Incoming message contents

### View Webhook Logs in Browser

Visit your webhook display endpoint to see webhook payloads:
- **Production**: `https://your-project.vercel.app/api/webhook-display`
- **Local**: `http://localhost:3000/api/webhook-display`

The display page shows:
- All received webhook events
- Event types (message, status, etc.)
- Full JSON payloads
- Auto-refreshes every 5 seconds

**Note:** The display endpoint uses in-memory storage, so logs won't persist across serverless function invocations. For production, consider integrating a database.

## Monitoring

View your webhook logs in:
- **Vercel Dashboard**: Go to your project > Functions > View logs
- **Local Development**: Check your terminal output
- **Webhook Display Page**: Visit `/api/webhook-display` for a visual dashboard

## Customization

Edit `api/webhook.js` to:
- Store webhook data in a database
- Send notifications to other services
- Process messages and send automated replies
- Add webhook signature verification for enhanced security

## Security

- The webhook verify token ensures only Meta can verify your webhook
- Consider adding webhook signature verification for production use
- Keep your `WEBHOOK_VERIFY_TOKEN` secret and never commit it to version control

## License

MIT


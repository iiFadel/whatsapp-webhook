/**
 * WhatsApp Webhook Handler
 * 
 * This endpoint handles:
 * - GET: Webhook verification (WhatsApp sends a challenge)
 * - POST: Webhook events (messages, delivery status, read receipts, etc.)
 */

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Verify the webhook token
    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('Webhook verification failed');
      res.status(403).send('Forbidden');
    }
    return;
  }

  // Handle POST request for webhook events
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Log the webhook payload for debugging
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      // WhatsApp sends webhook notifications in this format:
      // {
      //   "object": "whatsapp_business_account",
      //   "entry": [...]
      // }

      if (body.object === 'whatsapp_business_account') {
        body.entry?.forEach((entry) => {
          // Process each entry
          entry.changes?.forEach((change) => {
            const value = change.value;

            // Handle different types of notifications
            if (value.messages) {
              // Incoming messages
              value.messages.forEach((message) => {
                console.log('Incoming message:', {
                  from: message.from,
                  messageId: message.id,
                  timestamp: message.timestamp,
                  type: message.type,
                  // Message content varies by type (text, image, etc.)
                });
              });
            }

            if (value.statuses) {
              // Message status updates (sent, delivered, read)
              value.statuses.forEach((status) => {
                console.log('Message status:', {
                  messageId: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipientId: status.recipient_id,
                });
              });
            }
          });
        });

        // Optionally forward to display endpoint for visualization
      // Uncomment the following lines if you want to display webhooks in the browser
      // Note: This requires the webhook-display endpoint to be deployed
      // try {
      //   const baseUrl = process.env.VERCEL_URL 
      //     ? `https://${process.env.VERCEL_URL}` 
      //     : 'http://localhost:3000';
      //   await fetch(`${baseUrl}/api/webhook-display`, {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify(body),
      //   });
      // } catch (err) {
      //   console.error('Error forwarding to display:', err);
      // }

      // Return 200 OK to acknowledge receipt
        res.status(200).json({ success: true });
      } else {
        // Unknown webhook type
        console.log('Unknown webhook object type:', body.object);
        res.status(200).json({ success: true });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
    return;
  }

  // Method not allowed
  res.status(405).json({ error: 'Method not allowed' });
}


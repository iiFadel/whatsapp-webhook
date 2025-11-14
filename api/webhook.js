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

      if (body.object === 'whatsapp_business_account') {
        body.entry?.forEach(async (entry) => {
          // Process each entry
          entry.changes?.forEach(async (change) => {
            const value = change.value;

            // Handle incoming messages
            if (value.messages) {
              for (const message of value.messages) {
                console.log('Incoming message:', {
                  from: message.from,
                  messageId: message.id,
                  timestamp: message.timestamp,
                  type: message.type,
                });

                // Send to n8n webhook
                await sendToN8n({
                  type: 'message',
                  from: message.from,
                  messageId: message.id,
                  timestamp: message.timestamp,
                  messageType: message.type,
                  message: message, // Full message object
                  metadata: value.metadata, // Business phone number info
                  contacts: value.contacts, // Contact info
                });
              }
            }

            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                console.log('Message status:', {
                  messageId: status.id,
                  status: status.status,
                  timestamp: status.timestamp,
                  recipientId: status.recipient_id,
                });

                // Optionally send status updates to n8n
                // await sendToN8n({
                //   type: 'status',
                //   messageId: status.id,
                //   status: status.status,
                //   timestamp: status.timestamp,
                //   recipientId: status.recipient_id,
                // });
              }
            }
          });
        });

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

/**
 * Send data to n8n webhook
 */
async function sendToN8n(data) {
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!n8nWebhookUrl) {
    console.error('N8N_WEBHOOK_URL not configured');
    return;
  }

  try {
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned status ${response.status}`);
    }

    console.log('Successfully sent to n8n:', data.type);
  } catch (error) {
    console.error('Error sending to n8n:', error);
    // Don't throw - we don't want to fail the webhook if n8n is down
  }
}
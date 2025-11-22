/**
 * WhatsApp Webhook Handler
 * 
 * This endpoint handles:
 * - GET: Webhook verification (WhatsApp sends a challenge)
 * - POST: Webhook events (messages, delivery status, read receipts, etc.)
 */

const sessions = new Map();

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
          console.log('Webhook received:', JSON.stringify(body, null, 2));

          if (body.object === 'whatsapp_business_account') {
            body.entry?.forEach(async (entry) => {
              entry.changes?.forEach(async (change) => {
                const value = change.value;

                if (value.messages) {
                  for (const message of value.messages) {
                    console.log('Incoming message:', {
                      from: message.from,
                      messageId: message.id,
                      timestamp: message.timestamp,
                      type: message.type,
                    });
                    
                    const userId = message.from;
                    
                    // Get or create session for this user
                    let session = sessions.get(userId);
                    
                    if (!session) {
                      // New conversation - trigger n8n workflow
                      session = {
                        userId,
                        state: 'init',
                        createdAt: Date.now(),
                        resumeUrl: null
                      };
                      sessions.set(userId, session);
                      
                      // Start n8n workflow
                      await startN8nWorkflow({
                        userId,
                        message,
                        metadata: value.metadata,
                        contacts: value.contacts,
                      });
                    } else if (session.resumeUrl) {
                      // Resume existing workflow
                      await resumeN8nWorkflow(session.resumeUrl, {
                        userId,
                        message,
                        metadata: value.metadata,
                        contacts: value.contacts,
                      });
                    }
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
 * Start new n8n workflow
 */
async function startN8nWorkflow(data) {
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
      body: JSON.stringify({
        type: 'start',
        ...data
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned status ${response.status}`);
    }

    console.log('Successfully started n8n workflow for user:', data.userId);
  } catch (error) {
    console.error('Error starting n8n workflow:', error);
  }
}

/**
 * Resume n8n workflow
 */
async function resumeN8nWorkflow(resumeUrl, data) {
  try {
    const response = await fetch(resumeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`n8n resume webhook returned status ${response.status}`);
    }

    console.log('Successfully resumed n8n workflow for user:', data.userId);
  } catch (error) {
    console.error('Error resuming n8n workflow:', error);
  }
}
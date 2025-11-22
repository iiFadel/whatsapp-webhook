/**
 * WhatsApp Webhook Handler with Session Management
 */

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

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

  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('Webhook received:', JSON.stringify(body, null, 2));

      if (body.object === 'whatsapp_business_account') {
        // Process all entries
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;

            if (value.messages) {
              for (const message of value.messages) {
                const userId = message.from;
                
                console.log('Processing message from user:', userId);

                // Get session for this user
                const session = await getSession(userId);
                
                if (session && session.resumeUrl) {
                  // Resume existing workflow
                  console.log('Resuming workflow with URL:', session.resumeUrl);
                  await resumeN8nWorkflow(session.resumeUrl, {
                    userId,
                    message,
                    metadata: value.metadata,
                    contacts: value.contacts,
                  });
                } else {
                  // Start new workflow
                  console.log('Starting new workflow for user:', userId);
                  await startN8nWorkflow({
                    userId,
                    message,
                    metadata: value.metadata,
                    contacts: value.contacts,
                  });
                }
              }
            }

            // Handle message status updates (optional)
            if (value.statuses) {
              for (const status of value.statuses) {
                console.log('Message status:', status);
              }
            }
          }
        }

        res.status(200).json({ success: true });
      } else {
        console.log('Unknown webhook object type:', body.object);
        res.status(200).json({ success: true });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

/**
 * Get session from your session API
 */
async function getSession(userId) {
  try {
    const response = await fetch(
      `${process.env.VERCEL_URL || 'https://whatsapp-webhook-ochre.vercel.app'}/api/session?userId=${userId}`,
      {
        method: 'GET',
        headers: {
          'x-auth-token': process.env.N8N_AUTH_TOKEN,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to get session:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Retrieved session:', data.session);
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
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

    const result = await response.text();
    console.log('Successfully started n8n workflow:', result);
  } catch (error) {
    console.error('Error starting n8n workflow:', error);
  }
}

/**
 * Resume n8n workflow
 */
async function resumeN8nWorkflow(resumeUrl, data) {
  if (!resumeUrl) {
    console.error('No resume URL provided');
    return;
  }

  try {
    console.log('Calling resume URL:', resumeUrl);
    console.log('With data:', JSON.stringify(data, null, 2));

    const response = await fetch(resumeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n resume webhook returned status ${response.status}: ${errorText}`);
    }

    const result = await response.text();
    console.log('Successfully resumed n8n workflow:', result);
  } catch (error) {
    console.error('Error resuming n8n workflow:', error);
  }
}
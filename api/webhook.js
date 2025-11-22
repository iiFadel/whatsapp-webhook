/**
 * WhatsApp Webhook Handler - ONLY RESUMES workflows
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
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value;

            if (value.messages) {
              for (const message of value.messages) {
                const userId = message.from;
                
                console.log('Message from:', userId, 'Type:', message.type);

                // Get the session for this user
                const session = await getSession(userId);
                
                if (session && session.resumeUrl) {
                  // Resume the waiting workflow
                  console.log('Resuming workflow at:', session.resumeUrl);
                  await resumeN8nWorkflow(session.resumeUrl, {
                    userId,
                    message,
                    metadata: value.metadata,
                    contacts: value.contacts,
                  });
                } else {
                  console.log('No active session found for user:', userId);
                  // Optionally send a message saying they need to start the process
                  // or just ignore messages from users without active sessions
                }
              }
            }
          }
        }

        res.status(200).json({ success: true });
      } else {
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
    const sessionApiUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/session`
      : 'https://whatsapp-webhook-ochre.vercel.app/api/session';
      
    const response = await fetch(
      `${sessionApiUrl}?userId=${userId}`,
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
    return data.session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
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

    const response = await fetch(resumeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseText = await response.text();
    console.log('Resume response:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Resume failed: ${response.status} - ${responseText}`);
    }

    console.log('✅ Successfully resumed workflow');
  } catch (error) {
    console.error('❌ Error resuming workflow:', error);
  }
}
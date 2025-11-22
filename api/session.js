/**
 * Session Management API
 * Used by n8n to store/retrieve resume URLs
 */

// Use external storage for production (Redis, Database, etc.)
const sessions = new Map();

export default async function handler(req, res) {
  // Verify request from n8n (optional but recommended)
  const authToken = req.headers['x-auth-token'];
  if (authToken !== process.env.N8N_AUTH_TOKEN) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    // Store session data
    const { userId, resumeUrl, state, data } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const session = sessions.get(userId) || {};
    sessions.set(userId, {
      ...session,
      userId,
      resumeUrl,
      state,
      data,
      updatedAt: Date.now()
    });

    return res.status(200).json({ success: true });
  }

  if (req.method === 'GET') {
    // Retrieve session data
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const session = sessions.get(userId);
    return res.status(200).json({ session: session || null });
  }

  if (req.method === 'DELETE') {
    // Clear session
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    sessions.delete(userId);
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
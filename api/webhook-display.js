/**
 * Webhook Display Endpoint
 * 
 * This endpoint stores and displays webhook payloads
 * For development/testing purposes
 */

// Note: In-memory storage won't persist across serverless function invocations
// For production, use a database (Vercel KV, MongoDB, PostgreSQL, etc.)
// This is a simple demo that works for testing with frequent requests
let webhookLogs = [];

// In production, replace this with database calls
async function getLogs() {
  // Example: return await db.getLogs();
  return webhookLogs;
}

async function addLog(log) {
  // Example: await db.addLog(log);
  webhookLogs.push(log);
  if (webhookLogs.length > 100) {
    webhookLogs = webhookLogs.slice(-100);
  }
}

async function clearLogs() {
  // Example: await db.clearLogs();
  webhookLogs = [];
}

export default async function handler(req, res) {
  // Handle GET request - display webhook logs
  if (req.method === 'GET') {
    const logs = await getLogs();
    const logsHtml = logs.length === 0 
      ? `<div class="empty-state">
          <h2>No webhook events yet</h2>
          <p>Send a message or wait for webhook notifications to appear here</p>
        </div>`
      : logs.map((log) => `
          <div class="log-entry">
            <div class="log-header">
              <span class="log-time">${log.timestamp}</span>
              <span class="log-type ${log.type}">${log.type.toUpperCase()}</span>
            </div>
            <pre>${JSON.stringify(log.data, null, 2)}</pre>
          </div>
        `).reverse().join('');

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Webhook Logs</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          .controls {
            background: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            gap: 10px;
            align-items: center;
            flex-wrap: wrap;
          }
          button {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
          }
          button:hover {
            background: #5568d3;
          }
          .count {
            margin-left: auto;
            font-weight: bold;
            color: #667eea;
          }
          .logs {
            display: grid;
            gap: 20px;
          }
          .log-entry {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .log-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #f0f0f0;
          }
          .log-time {
            color: #666;
            font-size: 0.9em;
          }
          .log-type {
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
          }
          .log-type.message { background: #10b981; }
          .log-type.status { background: #f59e0b; }
          .log-type.verification { background: #3b82f6; }
          pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 0.9em;
            line-height: 1.5;
            border: 1px solid #e9ecef;
          }
          .empty-state {
            background: white;
            padding: 60px 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .empty-state h2 {
            color: #667eea;
            margin-bottom: 10px;
          }
          .empty-state p {
            color: #666;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .log-entry {
            animation: fadeIn 0.3s ease-in;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 WhatsApp Webhook Logs</h1>
          <div class="controls">
            <button onclick="location.reload()">🔄 Refresh</button>
            <button onclick="clearLogs()">🗑️ Clear Logs</button>
            <div class="count">Total Events: ${logs.length}</div>
          </div>
          <div class="logs">
            ${logsHtml}
          </div>
        </div>
        <script>
          function clearLogs() {
            if (confirm('Are you sure you want to clear all logs?')) {
              fetch('/api/webhook-display', { method: 'DELETE' })
                .then(() => location.reload());
            }
          }
          // Auto-refresh every 5 seconds
          setTimeout(() => location.reload(), 5000);
        </script>
      </body>
      </html>
    `);
    return;
  }

  // Handle POST request - store webhook data
  if (req.method === 'POST') {
    const timestamp = new Date().toISOString();
    const body = req.body;
    
    // Determine log type
    let type = 'unknown';
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      
      if (value?.messages) {
        type = 'message';
      } else if (value?.statuses) {
        type = 'status';
      }
    }

    // Store the webhook log
    await addLog({
      timestamp,
      type,
      data: body,
    });

    res.status(200).json({ success: true, stored: true });
    return;
  }

  // Handle DELETE request - clear logs
  if (req.method === 'DELETE') {
    await clearLogs();
    res.status(200).json({ success: true, cleared: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}


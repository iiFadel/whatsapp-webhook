import crypto from "crypto";

export default async function handler(req, res) {
  // Accept both GET and POST
  if (req.method === "GET") {
    // Some providers send GET requests for webhook verification
    return res.status(200).json({ 
      status: "webhook endpoint is active",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // Log the incoming request for debugging
    console.log("📱 WhatsApp webhook received:", {
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    // Verify signature if present
    const signature = req.headers["x-webhook-signature"];
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

    if (secret && signature) {
      const payload = JSON.stringify(req.body);
      const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      
      if (hash !== signature) {
        console.error("❌ Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
      console.log("✅ Signature verified");
    }

    // Extract event and data (handle different payload structures)
    const event = req.body.event;
    const data = req.body.data || {};
    const timestamp = req.body.timestamp;
    const sessionId = req.body.session_id;

    // Validate required fields
    if (!event) {
      console.error("❌ Missing event field in payload");
      return res.status(400).json({ 
        error: "Missing required field: event",
        received: req.body 
      });
    }

    console.log(`✅ Event: ${event}, Session: ${sessionId}`);

    // Helper to forward to n8n
    async function forwardToN8n(url, payload) {
      if (!url) {
        console.log("⚠️ n8n URL not configured, skipping forward");
        return false;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log(`✅ n8n notified for ${event}`);
          return true;
        } else {
          console.error(`❌ n8n error: ${response.status}`);
          return false;
        }
      } catch (error) {
        console.error(`❌ Failed to notify n8n:`, error.message);
        return false;
      }
    }

    // Route different events
    switch(event) {
      
      // Test webhook
      case "webhook.test":
        console.log("🧪 Test webhook received:", data.message);
        // Test is successful, just acknowledge
        break;

      // Incoming messages
      case "messages.received":
      case "messages-personal.received":
        console.log("💬 Message received from:", data.from);
        
        await forwardToN8n(process.env.N8N_WHATSAPP_MESSAGE_WEBHOOK_URL, {
          event: "message_received",
          session_id: sessionId,
          from: data.from,
          to: data.to,
          message: {
            id: data.key?.id,
            text: data.message?.conversation || 
                  data.message?.extendedTextMessage?.text ||
                  data.text,
            timestamp: timestamp,
            type: data.message?.messageType || "text"
          },
          contact: {
            name: data.pushName || data.name,
            phone: data.from
          },
          raw_data: data
        });
        break;

      // Message sent
      case "message.sent":
        console.log("✅ Message sent:", data.key?.id || data.message_id);
        break;

      // Message status update
      case "message-receipt.update":
        console.log("📬 Message receipt:", data.receipt);
        break;

      // Session status
      case "session.status":
        console.log("🔌 Session status:", data.status);
        if (data.status === "disconnected" || data.status === "offline") {
          await forwardToN8n(process.env.N8N_ALERT_WEBHOOK_URL, {
            event: "whatsapp_disconnected",
            session_id: sessionId,
            status: data.status,
            timestamp: timestamp
          });
        }
        break;

      // QR code updated
      case "qrcode.updated":
        console.log("📱 QR code updated");
        break;

      default:
        console.log(`ℹ️ Unhandled event: ${event}`);
    }

    // ALWAYS return 200 to acknowledge receipt
    return res.status(200).json({ 
      success: true,
      message: "Webhook received successfully",
      event: event,
      session_id: sessionId,
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    // Log error but still return 200 to prevent retries
    console.error("❌ Error processing webhook:", error);
    
    return res.status(200).json({ 
      success: false,
      error: error.message,
      message: "Error logged, webhook acknowledged",
      timestamp: new Date().toISOString()
    });
  }
}
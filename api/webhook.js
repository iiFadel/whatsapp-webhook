import crypto from "crypto";

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Log incoming webhook for debugging
  console.log("📱 WhatsApp webhook received:", {
    event: req.body.event,
    timestamp: new Date().toISOString()
  });

  const event = req.body.event;
  const data = req.body.data;

  const signature = req.headers["x-webhook-signature"];
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (secret && signature) {
    const payload = JSON.stringify(req.body);
    const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    
    if (hash !== signature) {
      console.error("❌ Invalid WhatsApp webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  // Helper function to forward to n8n
  async function forwardToN8n(url, payload) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 10000
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
  try {
    switch(event) {
      
      case "messages.received":
      case "messages-personal.received":
        console.log("💬 Message received from:", data.from);
        
        await forwardToN8n(process.env.N8N_WHATSAPP_MESSAGE_WEBHOOK_URL, {
          event: "message_received",
          from: data.from,
          to: data.to,
          message: {
            id: data.key?.id,
            text: data.message?.conversation || data.message?.extendedTextMessage?.text,
            timestamp: data.messageTimestamp,
            type: data.message?.messageType || "text"
          },
          contact: {
            name: data.pushName,
            phone: data.from
          },
          raw_data: data
        });
        break;

      // Message sent confirmation
      case "message.sent":
        console.log("✅ Message sent successfully:", data.key?.id);
        break;


      // Session status (connection status)
      case "session.status":
        console.log("🔌 Session status:", data.status);
        if (data.status === "disconnected") {
          // Alert: WhatsApp disconnected!
          await forwardToN8n(process.env.N8N_ALERT_WEBHOOK_URL, {
            event: "whatsapp_disconnected",
            timestamp: new Date().toISOString()
          });
        }
        break;

      default:
        console.log(`ℹ️ Unhandled WhatsApp event: ${event}`);
    }

  } catch (error) {
    console.error("❌ Error processing WhatsApp webhook:", error);
  }

  res.status(200).json({ 
    success: true,
    event: event,
    processed_at: new Date().toISOString()
  });
}
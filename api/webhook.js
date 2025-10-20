import crypto from "crypto";



export default async function handler(req, res) {
  // ✅ Accept only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ✅ Safe body parsing
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (err) {
      console.error("❌ Invalid JSON:", err.message);
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  console.log("📩 Incoming WhatsApp Webhook:", {
    headers: req.headers,
    body,
  });

  const event = body?.event;
  const data = body?.data;

  // ✅ Signature validation
  const signature = req.headers["x-webhook-signature"];
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;

  if (secret && signature) {
    try {
      const payload = JSON.stringify(body);
      const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");

      if (hash !== signature) {
        console.error("❌ Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    } catch (err) {
      console.error("❌ Signature check failed:", err.message);
      return res.status(500).json({ error: "Signature check failed" });
    }
  }

  // ✅ Helper to forward data to n8n (optional)
  async function forwardToN8n(url, payload) {
    if (!url) return false;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`✅ Forwarded to n8n: ${url}`);
        return true;
      } else {
        console.error(`❌ n8n error ${response.status}`);
        return false;
      }
    } catch (err) {
      console.error("❌ Failed to reach n8n:", err.message);
      return false;
    }
  }

  // ✅ Main logic
  try {
    switch (event) {
      case "webhook.test":
        console.log("🧪 Test webhook received:", data?.message);
        break;

      case "messages.received":
      case "messages-personal.received":
        console.log("💬 Message received from:", data?.from);
        await forwardToN8n(process.env.N8N_WHATSAPP_MESSAGE_WEBHOOK_URL, {
          event: "message_received",
          from: data?.from,
          to: data?.to,
          message: {
            id: data?.key?.id,
            text: data?.message?.conversation || data?.message?.extendedTextMessage?.text,
            timestamp: data?.messageTimestamp,
            type: data?.message?.messageType || "text",
          },
          contact: {
            name: data?.pushName,
            phone: data?.from,
          },
          raw_data: data,
        });
        break;

      case "message.sent":
        console.log("✅ Message sent:", data?.key?.id);
        break;

      case "session.status":
        console.log("🔌 Session status:", data?.status);
        if (data?.status === "disconnected") {
          await forwardToN8n(process.env.N8N_ALERT_WEBHOOK_URL, {
            event: "whatsapp_disconnected",
            timestamp: new Date().toISOString(),
          });
        }
        break;

      default:
        console.log(`ℹ️ Unhandled event: ${event}`);
    }
  } catch (err) {
    console.error("❌ Error handling webhook:", err);
  }

  // ✅ Always respond 200 OK
  return res.status(200).json({
    success: true,
    event: event || "unknown",
    received_at: new Date().toISOString(),
  });
}
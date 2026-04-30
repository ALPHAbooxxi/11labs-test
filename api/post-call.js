const { insertPostCallEvent } = require("../lib/supabase");
const { verifyElevenLabsSignature } = require("../lib/elevenlabs-signature");
const { readRawBody } = require("../lib/raw-body");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signatureHeader = req.headers["elevenlabs-signature"];
    const verification = verifyElevenLabsSignature(
      rawBody,
      signatureHeader,
      process.env.ELEVENLABS_WEBHOOK_SECRET
    );

    if (!verification.valid) {
      res.status(401).json({
        error: "invalid_signature",
        reason: verification.reason
      });
      return;
    }

    const event = JSON.parse(rawBody);

    if (!event || !event.type) {
      res.status(400).json({ error: "invalid_payload" });
      return;
    }

    if (event.type === "post_call_transcription") {
      const saved = await insertPostCallEvent(event);
      res.status(200).json({
        received: true,
        stored: true,
        event_type: event.type,
        call_event_id: saved.id
      });
      return;
    }

    res.status(200).json({
      received: true,
      stored: false,
      event_type: event.type
    });
  } catch (error) {
    res.status(500).json({
      error: "internal_error",
      message: error.message
    });
  }
};

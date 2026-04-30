const crypto = require("crypto");

function parseSignatureHeader(header) {
  if (!header) {
    return null;
  }

  const parts = header.split(",");
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const hashPart = parts.find((part) => part.startsWith("v0="));

  if (!timestampPart || !hashPart) {
    return null;
  }

  return {
    timestamp: timestampPart.slice(2),
    signature: hashPart.slice(3)
  };
}

function verifyElevenLabsSignature(rawBody, header, secret) {
  if (!secret) {
    throw new Error("ELEVENLABS_WEBHOOK_SECRET fehlt");
  }

  const parsed = parseSignatureHeader(header);
  if (!parsed) {
    return { valid: false, reason: "missing_or_invalid_header" };
  }

  const now = Math.floor(Date.now() / 1000);
  const toleranceSeconds = 30 * 60;
  const timestamp = Number(parsed.timestamp);

  if (!Number.isFinite(timestamp) || timestamp < now - toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_range" };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");

  const provided = parsed.signature;
  const valid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));

  if (!valid) {
    return { valid: false, reason: "signature_mismatch" };
  }

  return { valid: true };
}

module.exports = {
  verifyElevenLabsSignature
};

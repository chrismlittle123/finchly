import crypto from "node:crypto";

const SLACK_TIMESTAMP_MAX_AGE_SECONDS = 300;

export function verifySlackSignature(
  signingSecret: string,
  signature: string | undefined,
  timestamp: string | undefined,
  rawBody: Buffer,
): boolean {
  if (!signature || !timestamp) return false;

  // Reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > SLACK_TIMESTAMP_MAX_AGE_SECONDS) return false;

  const sigBasestring = `v0:${timestamp}:${rawBody.toString("utf-8")}`;
  const mySignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature),
  );
}

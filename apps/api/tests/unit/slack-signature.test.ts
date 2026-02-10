import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySlackSignature } from "../../src/lib/slack.js";

const SECRET = "test-signing-secret";

function createSignature(secret: string, timestamp: string, body: string) {
  const sigBasestring = `v0:${timestamp}:${body}`;
  const hash = crypto.createHmac("sha256", secret).update(sigBasestring).digest("hex");
  return `v0=${hash}`;
}

describe("verifySlackSignature", () => {
  it("returns true for valid signature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"url_verification"}';
    const signature = createSignature(SECRET, timestamp, body);

    assert.equal(
      verifySlackSignature(SECRET, signature, timestamp, Buffer.from(body)),
      true,
    );
  });

  it("returns false for invalid signature", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"url_verification"}';
    // Use a wrong secret to produce a valid-length but incorrect signature
    const wrongSignature = createSignature("wrong-secret", timestamp, body);

    assert.equal(
      verifySlackSignature(SECRET, wrongSignature, timestamp, Buffer.from(body)),
      false,
    );
  });

  it("returns false when signature is missing", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    assert.equal(
      verifySlackSignature(SECRET, undefined, timestamp, Buffer.from("")),
      false,
    );
  });

  it("returns false when timestamp is too old", () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const body = '{"test":true}';
    const signature = createSignature(SECRET, oldTimestamp, body);

    assert.equal(
      verifySlackSignature(SECRET, signature, oldTimestamp, Buffer.from(body)),
      false,
    );
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractUrls } from "../../src/lib/urls.js";

describe("extractUrls", () => {
  it("extracts URLs from text", () => {
    const text = "Check out https://example.com and http://test.org/path";
    assert.deepEqual(extractUrls(text), [
      "https://example.com",
      "http://test.org/path",
    ]);
  });

  it("returns empty array for text without URLs", () => {
    assert.deepEqual(extractUrls("no urls here"), []);
  });

  it("returns empty array for undefined", () => {
    assert.deepEqual(extractUrls(undefined), []);
  });

  it("handles Slack-formatted URLs with angle brackets", () => {
    const text = "Link: <https://example.com/page> shared";
    assert.deepEqual(extractUrls(text), ["https://example.com/page"]);
  });
});

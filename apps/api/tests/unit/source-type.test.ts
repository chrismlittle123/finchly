import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectSourceType, parseGitHubUrl } from "../../src/lib/source-type.js";

describe("detectSourceType", () => {
  it("detects github.com URLs", () => {
    assert.equal(detectSourceType("https://github.com/anthropics/claude-code"), "github");
  });

  it("detects www.github.com URLs", () => {
    assert.equal(detectSourceType("https://www.github.com/owner/repo"), "github");
  });

  it("detects x.com URLs", () => {
    assert.equal(detectSourceType("https://x.com/elonmusk/status/123456"), "x");
  });

  it("detects twitter.com URLs", () => {
    assert.equal(detectSourceType("https://twitter.com/user/status/789"), "x");
  });

  it("detects x.com/i/status/ URLs", () => {
    assert.equal(detectSourceType("https://x.com/i/status/123456"), "x");
  });

  it("detects mobile.twitter.com URLs", () => {
    assert.equal(detectSourceType("https://mobile.twitter.com/user/status/123"), "x");
  });

  it("returns webpage for generic URLs", () => {
    assert.equal(detectSourceType("https://example.com/article"), "webpage");
  });

  it("returns webpage for invalid URLs", () => {
    assert.equal(detectSourceType("not-a-url"), "webpage");
  });
});

describe("parseGitHubUrl", () => {
  it("extracts owner and repo", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/anthropics/claude-code"),
      { owner: "anthropics", repo: "claude-code" },
    );
  });

  it("handles extra path segments", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/anthropics/claude-code/tree/main/src"),
      { owner: "anthropics", repo: "claude-code" },
    );
  });

  it("returns null for GitHub root URL", () => {
    assert.equal(parseGitHubUrl("https://github.com"), null);
  });

  it("returns null for GitHub user-only URL", () => {
    assert.equal(parseGitHubUrl("https://github.com/anthropics"), null);
  });

  it("returns null for non-GitHub URLs", () => {
    assert.equal(parseGitHubUrl("https://example.com/owner/repo"), null);
  });

  it("returns null for invalid URLs", () => {
    assert.equal(parseGitHubUrl("not-a-url"), null);
  });
});

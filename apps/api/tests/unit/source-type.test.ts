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
  it("extracts owner and repo for root URL", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/anthropics/claude-code"),
      { owner: "anthropics", repo: "claude-code", pathType: "root" },
    );
  });

  it("parses /tree/ URL (subdirectory)", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/anthropics/claude-code/tree/main/src"),
      { owner: "anthropics", repo: "claude-code", pathType: "tree", ref: "main", filePath: "src" },
    );
  });

  it("parses /tree/ URL with nested path", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/drizzle-team/drizzle-orm/tree/main/drizzle-orm/src"),
      { owner: "drizzle-team", repo: "drizzle-orm", pathType: "tree", ref: "main", filePath: "drizzle-orm/src" },
    );
  });

  it("parses /blob/ URL (specific file)", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/anthropics/claude-code/blob/main/README.md"),
      { owner: "anthropics", repo: "claude-code", pathType: "blob", ref: "main", filePath: "README.md" },
    );
  });

  it("parses /blob/ URL with nested file path", () => {
    assert.deepEqual(
      parseGitHubUrl("https://github.com/fastify/fastify/blob/main/docs/Guides/Getting-Started.md"),
      { owner: "fastify", repo: "fastify", pathType: "blob", ref: "main", filePath: "docs/Guides/Getting-Started.md" },
    );
  });

  it("handles /tree/ref with no subpath as tree without filePath", () => {
    const result = parseGitHubUrl("https://github.com/owner/repo/tree/main");
    assert.deepEqual(result, { owner: "owner", repo: "repo", pathType: "tree", ref: "main", filePath: undefined });
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

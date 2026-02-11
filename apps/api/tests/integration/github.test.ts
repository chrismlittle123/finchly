import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enrichGitHub } from "../../src/services/enrichment/github.js";
import { detectSourceType, parseGitHubUrl } from "../../src/lib/source-type.js";
import type { EnricherContext } from "../../src/services/enrichment/types.js";

/** Minimal context — no DB needed, just env + a silent logger. */
const ctx = {
  db: {} as EnricherContext["db"],
  env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN } as EnricherContext["env"],
  logger: {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {},
  } as unknown as EnricherContext["logger"],
};

const TEST_REPOS = [
  {
    url: "https://github.com/anthropics/anthropic-sdk-python",
    label: "Anthropic SDK Python — large README",
    owner: "anthropics",
    repo: "anthropic-sdk-python",
  },
  {
    url: "https://github.com/drizzle-team/drizzle-orm",
    label: "Drizzle ORM — monorepo with README",
    owner: "drizzle-team",
    repo: "drizzle-orm",
  },
  {
    url: "https://github.com/fastify/fastify",
    label: "Fastify — popular framework",
    owner: "fastify",
    repo: "fastify",
  },
];

describe("GitHub enrichment integration — live calls", () => {
  for (const testCase of TEST_REPOS) {
    it(`fetches and enriches: ${testCase.label}`, async () => {
      assert.equal(detectSourceType(testCase.url), "github");

      const parsed = parseGitHubUrl(testCase.url);
      assert.ok(parsed);
      assert.equal(parsed.owner, testCase.owner);
      assert.equal(parsed.repo, testCase.repo);

      const result = await enrichGitHub(testCase.url, ctx);

      assert.equal(result.sourceType, "github");
      assert.ok(result.title, "Should have title (full_name)");
      assert.ok(result.title!.includes("/"), "Title should be owner/repo format");
      // description is optional — some repos don't set one
      assert.equal(typeof result.description, result.description ? "string" : "undefined");
      assert.ok(result.imageUrl, "Should have owner avatar URL");
      assert.ok(result.rawContent, "Should have README content");
      assert.ok(result.rawContent!.length > 100, "README should be substantial");
      assert.ok(
        result.rawContent!.includes("#") || result.rawContent!.includes("##"),
        "README should contain markdown headings",
      );
    });
  }
});

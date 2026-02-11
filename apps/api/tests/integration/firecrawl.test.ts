import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { enrichWebpage } from "../../src/services/enrichment/webpage.js";
import type { EnricherContext } from "../../src/services/enrichment/types.js";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

/** Minimal context — no DB needed, just env + a silent logger. */
function makeCtx(): EnricherContext {
  return {
    db: {} as EnricherContext["db"],
    env: { FIRECRAWL_API_KEY } as EnricherContext["env"],
    logger: {
      info: () => {},
      warn: () => {},
      debug: () => {},
      error: () => {},
    } as unknown as EnricherContext["logger"],
  };
}

const TEST_PAGES = [
  {
    url: "https://every.to/napkin-math/the-ai-strategy-tax",
    label: "Every.to blog post — should have title, description, markdown",
  },
  {
    url: "https://docs.firecrawl.dev",
    label: "Firecrawl docs — should scrape their own docs",
  },
  {
    url: "https://fastify.dev",
    label: "Fastify homepage — should extract basic metadata",
  },
];

describe("Firecrawl enrichment integration — live calls", () => {
  before(() => {
    if (!FIRECRAWL_API_KEY) {
      console.log("  FIRECRAWL_API_KEY not set — skipping Firecrawl tests");
    }
  });

  for (const testCase of TEST_PAGES) {
    it(`scrapes and enriches: ${testCase.label}`, { skip: !FIRECRAWL_API_KEY }, async () => {
      const result = await enrichWebpage(testCase.url, makeCtx());

      assert.equal(result.sourceType, "webpage");
      assert.ok(result.title, `Should have title for: ${testCase.label}`);
      assert.ok(result.rawContent, `Should have markdown content for: ${testCase.label}`);
      assert.ok(result.rawContent!.length > 100, "Markdown content should be substantial");
    });
  }
});

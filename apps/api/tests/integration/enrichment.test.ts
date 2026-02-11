import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractTweetId, fetchSyndication, buildEnrichmentResult } from "../../src/services/enrichment/x.js";
import { detectSourceType } from "../../src/lib/source-type.js";

/**
 * Integration tests that call Twitter's syndication CDN (cdn.syndication.twimg.com).
 * No auth required — this powers Twitter's embed widgets.
 */

const TEST_TWEETS = [
  {
    url: "https://x.com/pmigdal/status/2021244382800760873",
    label: "Piotr Migdal — BinaryAudit (link + image)",
    expectLinks: true,
    expectImage: true,
    expectArticle: false,
  },
  {
    url: "https://x.com/sama/status/2019474754529321247",
    label: "Sam Altman — GPT-5.3-Codex (no links)",
    expectLinks: false,
    expectImage: false,
    expectArticle: false,
  },
  {
    url: "https://x.com/claudeai/status/2019467374420722022",
    label: "Claude AI — Opus 4.6 (image only)",
    expectLinks: false,
    expectImage: true,
    expectArticle: false,
  },
  {
    url: "https://x.com/francedot/status/2017858253439345092",
    label: "Francesco — Vibe Coding Paralysis (X Article)",
    expectLinks: false,
    expectImage: true,
    expectArticle: true,
  },
  {
    url: "https://x.com/ashtom/status/2021255786966708280",
    label: "Thomas Dohmke — EntireHQ announcement",
    expectLinks: false,
    expectImage: false,
    expectArticle: false,
  },
  {
    url: "https://twitter.com/simplifyinAI/status/2017896639818604625",
    label: "Simplifying AI — PageIndex (twitter.com domain)",
    expectLinks: false,
    expectImage: true,
    expectArticle: false,
  },
  {
    url: "https://x.com/0x0SojalSec/status/2017687437699670379",
    label: "Md Ismail — Microsandbox",
    expectLinks: false,
    expectImage: true,
    expectArticle: false,
  },
  {
    url: "https://x.com/trq212/status/2019173731042750509",
    label: "Thariq — /insights command (video)",
    expectLinks: false,
    expectImage: true,
    expectArticle: false,
  },
  {
    url: "https://x.com/i/status/2019474754529321247",
    label: "Sam Altman via /i/status/ URL format",
    expectLinks: false,
    expectImage: false,
    expectArticle: false,
  },
];

describe("Syndication API integration — live calls", () => {
  for (const testCase of TEST_TWEETS) {
    it(`fetches and enriches: ${testCase.label}`, async () => {
      assert.equal(detectSourceType(testCase.url), "x");

      const tweetId = extractTweetId(testCase.url);
      assert.ok(tweetId, "Should extract tweet ID");

      const tweet = await fetchSyndication(tweetId);
      assert.ok(tweet, "Syndication API should return data");
      assert.ok(tweet.text.length > 0, "Should have tweet text");
      assert.ok(tweet.user.name.length > 0, "Should have author name");
      assert.ok(tweet.user.screen_name.length > 0, "Should have handle");

      const result = buildEnrichmentResult(tweet);
      assert.equal(result.sourceType, "x");
      assert.ok(result.title, "Should have title");
      assert.ok(result.description, "Should have description");
      assert.ok(result.rawContent, "Should have rawContent");

      if (testCase.expectLinks) {
        assert.ok(result.extractedUrls && result.extractedUrls.length > 0,
          `Expected extracted URLs for: ${testCase.label}`);
      }

      if (testCase.expectImage) {
        assert.ok(result.imageUrl, `Expected imageUrl for: ${testCase.label}`);
      }

      if (testCase.expectArticle) {
        assert.ok(tweet.article, `Expected article data for: ${testCase.label}`);
        assert.ok(tweet.article!.title, "Article should have title");
        assert.ok(tweet.article!.preview_text, "Article should have preview_text");
      }
    });
  }
});

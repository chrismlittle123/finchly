import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractTweetId, buildEnrichmentResult } from "../../src/services/enrichment/x.js";
import type { SyndicationTweet } from "../../src/services/enrichment/x.js";

describe("extractTweetId", () => {
  it("extracts from x.com/user/status/ID", () => {
    assert.equal(extractTweetId("https://x.com/sama/status/123456"), "123456");
  });

  it("extracts from twitter.com/user/status/ID", () => {
    assert.equal(extractTweetId("https://twitter.com/user/status/789"), "789");
  });

  it("extracts from x.com/i/status/ID", () => {
    assert.equal(extractTweetId("https://x.com/i/status/123456"), "123456");
  });

  it("returns null for non-tweet URLs", () => {
    assert.equal(extractTweetId("https://x.com/user"), null);
  });

  it("returns null for invalid URLs", () => {
    assert.equal(extractTweetId("not-a-url"), null);
  });
});

// Helper to build a minimal SyndicationTweet for testing
function makeTweet(overrides: Partial<SyndicationTweet> = {}): SyndicationTweet {
  return {
    text: "Test tweet text",
    lang: "en",
    created_at: "2026-02-10T00:00:00.000Z",
    favorite_count: 100,
    conversation_count: 10,
    user: { name: "Test User", screen_name: "testuser", profile_image_url_https: "" },
    entities: { urls: [], user_mentions: [] },
    ...overrides,
  };
}

describe("buildEnrichmentResult", () => {
  it("builds basic tweet result", () => {
    const result = buildEnrichmentResult(makeTweet());
    assert.equal(result.title, "Test User (@testuser)");
    assert.equal(result.description, "Test tweet text");
    assert.equal(result.sourceType, "x");
    assert.ok(result.rawContent?.includes("@testuser: Test tweet text"));
  });

  it("extracts pre-resolved URLs from entities", () => {
    const result = buildEnrichmentResult(makeTweet({
      entities: {
        urls: [
          { url: "https://t.co/abc", expanded_url: "https://example.com/article", display_url: "example.com/article" },
        ],
        user_mentions: [],
      },
    }));
    assert.deepEqual(result.extractedUrls, ["https://example.com/article"]);
    assert.ok(result.rawContent?.includes("Links: https://example.com/article"));
  });

  it("filters out X Article URLs from extractedUrls", () => {
    const result = buildEnrichmentResult(makeTweet({
      entities: {
        urls: [
          { url: "https://t.co/abc", expanded_url: "http://x.com/i/article/123", display_url: "x.com/i/article" },
        ],
        user_mentions: [],
      },
    }));
    assert.deepEqual(result.extractedUrls, []);
  });

  it("uses article title and preview when present", () => {
    const result = buildEnrichmentResult(makeTweet({
      article: {
        title: "My Article Title",
        preview_text: "This is the article preview.",
        cover_media: {
          media_info: {
            original_img_url: "https://pbs.twimg.com/media/cover.jpg",
            original_img_width: 1200,
            original_img_height: 600,
          },
        },
      },
    }));
    assert.equal(result.title, "My Article Title");
    assert.ok(result.description?.includes("My Article Title"));
    assert.ok(result.description?.includes("This is the article preview."));
    assert.equal(result.imageUrl, "https://pbs.twimg.com/media/cover.jpg");
    assert.ok(result.rawContent?.includes("Article: My Article Title"));
  });

  it("picks photo URL as imageUrl", () => {
    const result = buildEnrichmentResult(makeTweet({
      photos: [{ url: "https://pbs.twimg.com/media/photo1.jpg" }],
    }));
    assert.equal(result.imageUrl, "https://pbs.twimg.com/media/photo1.jpg");
  });

  it("picks video poster as imageUrl when no photos", () => {
    const result = buildEnrichmentResult(makeTweet({
      video: { poster: "https://pbs.twimg.com/poster.jpg" },
    }));
    assert.equal(result.imageUrl, "https://pbs.twimg.com/poster.jpg");
  });

  it("article cover takes priority over photo", () => {
    const result = buildEnrichmentResult(makeTweet({
      photos: [{ url: "https://pbs.twimg.com/media/photo1.jpg" }],
      article: {
        title: "Article",
        preview_text: "Preview",
        cover_media: {
          media_info: {
            original_img_url: "https://pbs.twimg.com/media/cover.jpg",
            original_img_width: 1200,
            original_img_height: 600,
          },
        },
      },
    }));
    assert.equal(result.imageUrl, "https://pbs.twimg.com/media/cover.jpg");
  });

  it("returns undefined imageUrl when no media", () => {
    const result = buildEnrichmentResult(makeTweet());
    assert.equal(result.imageUrl, undefined);
  });

  it("uses fullText over syndication text when provided", () => {
    const truncated = makeTweet({ text: "This is truncated" });
    const fullText = "This is the full untruncated tweet text that goes on much longer";
    const result = buildEnrichmentResult(truncated, fullText);
    assert.equal(result.description, fullText);
    assert.ok(result.rawContent?.includes(fullText));
    assert.ok(!result.rawContent?.includes("This is truncated"));
  });

  it("falls back to syndication text when fullText is undefined", () => {
    const result = buildEnrichmentResult(makeTweet({ text: "Syndication text" }));
    assert.equal(result.description, "Syndication text");
  });
});

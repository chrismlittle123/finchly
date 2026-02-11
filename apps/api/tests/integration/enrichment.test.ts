import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOEmbedHtml } from "../../src/services/enrichment/x.js";
import { detectSourceType } from "../../src/lib/source-type.js";

/**
 * Integration tests that call the real Twitter oEmbed API.
 * No auth required — publish.twitter.com/oembed is free and public.
 */

const TEST_TWEETS = [
  {
    url: "https://x.com/pmigdal/status/2021244382800760873",
    label: "Piotr Migdal — BinaryAudit (link + image)",
    expectLinks: true,
    expectMedia: true,
  },
  {
    url: "https://x.com/sama/status/2019474754529321247",
    label: "Sam Altman — GPT-5.3-Codex (no links)",
    expectLinks: false,
    expectMedia: false,
  },
  {
    url: "https://x.com/claudeai/status/2019467374420722022",
    label: "Claude AI — Opus 4.6 (image only)",
    expectLinks: false,
    expectMedia: true,
  },
  {
    url: "https://x.com/francedot/status/2017858253439345092",
    label: "Francesco — URL-only tweet (lang=zxx)",
    expectLinks: true,
    expectMedia: false,
  },
  {
    url: "https://x.com/ashtom/status/2021255786966708280",
    label: "Thomas Dohmke — EntireHQ (@mention + link)",
    expectLinks: true,
    expectMedia: false,
  },
  {
    url: "https://twitter.com/simplifyinAI/status/2017896639818604625",
    label: "Simplifying AI — PageIndex (twitter.com domain)",
    expectLinks: false,
    expectMedia: true,
  },
  {
    url: "https://x.com/0x0SojalSec/status/2017687437699670379",
    label: "Md Ismail — Microsandbox (truncated text)",
    expectLinks: false,
    expectMedia: true,
  },
  {
    url: "https://x.com/trq212/status/2019173731042750509",
    label: "Thariq — /insights command (image only)",
    expectLinks: false,
    expectMedia: true,
  },
  {
    url: "https://x.com/i/status/2019474754529321247",
    label: "Sam Altman via /i/status/ URL format",
    expectLinks: false,
    expectMedia: false,
  },
];

describe("X/Twitter oEmbed integration — live API calls", () => {
  for (const tweet of TEST_TWEETS) {
    it(`fetches and parses: ${tweet.label}`, async () => {
      // Verify source type detection
      assert.equal(detectSourceType(tweet.url), "x");

      // Call the real oEmbed API
      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweet.url)}&omit_script=true`;
      const res = await fetch(oembedUrl);
      assert.equal(res.status, 200, `oEmbed API should return 200 for ${tweet.url}`);

      const data = (await res.json()) as { html: string; author_name: string; author_url: string };
      assert.ok(data.html, "Response should contain html");
      assert.ok(data.author_name, "Response should contain author_name");

      // Parse the HTML
      const parsed = parseOEmbedHtml(data.html);
      assert.ok(parsed.text.length > 0, "Should extract tweet text");
      assert.ok(parsed.handle.length > 0, "Should extract handle");
      assert.ok(parsed.author.length > 0, "Should extract author name");

      if (tweet.expectLinks) {
        assert.ok(parsed.links.length > 0, `Expected external links for: ${tweet.label}`);
        // All external links should be t.co URLs
        for (const link of parsed.links) {
          assert.ok(link.startsWith("https://t.co/"), `Link should be t.co URL: ${link}`);
        }
      }

      if (tweet.expectMedia) {
        assert.ok(parsed.mediaLinks.length > 0, `Expected media links for: ${tweet.label}`);
      }
    });
  }
});

describe("t.co redirect resolution — live", () => {
  it("resolves a t.co URL to its destination", async () => {
    // Use a known t.co link from the BinaryAudit tweet
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent("https://x.com/pmigdal/status/2021244382800760873")}&omit_script=true`;
    const res = await fetch(oembedUrl);
    const data = (await res.json()) as { html: string };
    const parsed = parseOEmbedHtml(data.html);

    assert.ok(parsed.links.length > 0, "Should have at least one t.co link");

    // Resolve the first t.co link
    const tcoUrl = parsed.links[0];
    const redirectRes = await fetch(tcoUrl, { redirect: "manual" });
    const location = redirectRes.headers.get("location");
    assert.ok(location, "t.co should return a Location header");
    assert.ok(!location.startsWith("https://t.co/"), "Resolved URL should not be another t.co link");
  });
});

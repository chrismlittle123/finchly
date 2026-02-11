import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseOEmbedHtml } from "../../src/services/enrichment/x.js";

// Real oEmbed HTML responses from publish.twitter.com

const TWEET_WITH_LINK_AND_IMAGE = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Claude can code, but can it read machine code?\n\nWe gave AI agents access to Ghidra (a decompiler by the NSA) and tasked them with finding hidden backdoors in servers - working solely from binaries, without any access to source code.\n\nSee our BinaryAudit: <a href="https://t.co/VPNk5ChPfH">https://t.co/VPNk5ChPfH</a> <a href="https://t.co/FtIyxzQfNN">pic.twitter.com/FtIyxzQfNN</a></p>&mdash; Piotr Migdal (@pmigdal) <a href="https://twitter.com/pmigdal/status/2021244382800760873?ref_src=twsrc%5Etfw">February 10, 2026</a></blockquote>`;

const TWEET_NO_LINKS = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">GPT-5.3-Codex is here!\n\n*Best coding performance (57% SWE-Bench Pro, 76% TerminalBench 2.0, 64% OSWorld).\n*Mid-task steerability and live updates during tasks.\n*Faster! Less than half the tokens of 5.2-Codex for same tasks, and &gt;25% faster per token!\n*Good computer use.</p>&mdash; Sam Altman (@sama) <a href="https://twitter.com/sama/status/2019474754529321247?ref_src=twsrc%5Etfw">February 5, 2026</a></blockquote>`;

const TWEET_IMAGE_ONLY = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Opus 4.6 is state-of-the-art on several evaluations including agentic coding, multi-discipline reasoning, knowledge work, and agentic search.\n\nWe&#39;re also shipping new features across Claude in Excel, Claude in PowerPoint, Claude Code, and our API to let Opus 4.6 do even more. <a href="https://t.co/AN83Zb7Osg">pic.twitter.com/AN83Zb7Osg</a></p>&mdash; Claude (@claudeai) <a href="https://twitter.com/claudeai/status/2019467374420722022?ref_src=twsrc%5Etfw">February 5, 2026</a></blockquote>`;

const TWEET_LINK_ONLY_ZXX = `<blockquote class="twitter-tweet"><p lang="zxx" dir="ltr"><a href="https://t.co/RbzyeSjatz">https://t.co/RbzyeSjatz</a></p>&mdash; Francesco (@francedot) <a href="https://twitter.com/francedot/status/2017858253439345092?ref_src=twsrc%5Etfw">February 1, 2026</a></blockquote>`;

const TWEET_WITH_MENTION = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">tl;dr Today, we&#39;re announcing our new company <a href="https://twitter.com/EntireHQ?ref_src=twsrc%5Etfw">@EntireHQ</a> to build the next developer platform for agent–human collaboration. Open, scalable, independent, and backed by a $60M seed round. Plus, we are shipping Checkpoints to automatically capture agent context.\n\nIn the last three… <a href="https://t.co/uWRGcGX2tQ">https://t.co/uWRGcGX2tQ</a></p>&mdash; Thomas Dohmke (@ashtom) <a href="https://twitter.com/ashtom/status/2021255786966708280?ref_src=twsrc%5Etfw">February 10, 2026</a></blockquote>`;

const TWEET_TRUNCATED_WITH_IMAGE = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Vector databases just got disrupted 🤯\n\nYou can now build RAG without Vector DBs.\n\nPageIndex is a new open-source library that uses document trees instead of embeddings.\n\nIt achieves 98.7% on FinanceBench by letting LLMs reason over structure rather than matching keywords.\n\n→ No… <a href="https://t.co/UL5vccn5dK">pic.twitter.com/UL5vccn5dK</a></p>&mdash; Simplifying AI (@simplifyinAI) <a href="https://twitter.com/simplifyinAI/status/2017896639818604625?ref_src=twsrc%5Etfw">February 1, 2026</a></blockquote>`;

describe("parseOEmbedHtml", () => {
  it("extracts tweet text, external link, and media link", () => {
    const result = parseOEmbedHtml(TWEET_WITH_LINK_AND_IMAGE);
    assert.ok(result.text.includes("Claude can code, but can it read machine code?"));
    assert.ok(result.text.includes("BinaryAudit"));
    assert.equal(result.author, "Piotr Migdal");
    assert.equal(result.handle, "pmigdal");
    assert.deepEqual(result.links, ["https://t.co/VPNk5ChPfH"]);
    assert.deepEqual(result.mediaLinks, ["https://t.co/FtIyxzQfNN"]);
  });

  it("handles tweets without any links", () => {
    const result = parseOEmbedHtml(TWEET_NO_LINKS);
    assert.ok(result.text.includes("GPT-5.3-Codex is here!"));
    assert.equal(result.author, "Sam Altman");
    assert.equal(result.handle, "sama");
    assert.deepEqual(result.links, []);
    assert.deepEqual(result.mediaLinks, []);
  });

  it("categorizes image-only links as media", () => {
    const result = parseOEmbedHtml(TWEET_IMAGE_ONLY);
    assert.ok(result.text.includes("Opus 4.6"));
    assert.equal(result.handle, "claudeai");
    assert.deepEqual(result.links, []);
    assert.deepEqual(result.mediaLinks, ["https://t.co/AN83Zb7Osg"]);
  });

  it("handles lang=zxx (URL-only tweets)", () => {
    const result = parseOEmbedHtml(TWEET_LINK_ONLY_ZXX);
    assert.equal(result.handle, "francedot");
    assert.deepEqual(result.links, ["https://t.co/RbzyeSjatz"]);
    assert.deepEqual(result.mediaLinks, []);
  });

  it("ignores @mention links in tweet body", () => {
    const result = parseOEmbedHtml(TWEET_WITH_MENTION);
    assert.equal(result.handle, "ashtom");
    // Should have the t.co link but NOT the @EntireHQ mention link
    assert.deepEqual(result.links, ["https://t.co/uWRGcGX2tQ"]);
    assert.deepEqual(result.mediaLinks, []);
  });

  it("handles truncated tweets with media", () => {
    const result = parseOEmbedHtml(TWEET_TRUNCATED_WITH_IMAGE);
    assert.ok(result.text.includes("Vector databases"));
    assert.equal(result.handle, "simplifyinAI");
    assert.deepEqual(result.links, []);
    assert.deepEqual(result.mediaLinks, ["https://t.co/UL5vccn5dK"]);
  });

  it("handles HTML entities correctly", () => {
    const result = parseOEmbedHtml(TWEET_NO_LINKS);
    // &gt; should be decoded to >
    assert.ok(result.text.includes(">25% faster"));
  });
});

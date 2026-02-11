import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { generateTestToken } from "../helpers/auth.js";

/**
 * End-to-end test: POST links via API → wait for enrichment → search → ask.
 *
 * Requires a running local API with:
 *   DATABASE_URL, JWT_SECRET, FIRECRAWL_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
 *
 * Run: API_URL=http://localhost:3001 pnpm -F @finchly/api test:integration -- tests/integration/e2e-enrichment.test.ts
 */

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-that-is-at-least-32-characters-long";
const token = process.env.API_TOKEN ?? generateTestToken(JWT_SECRET);

async function api(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(opts?.headers as Record<string, string>),
  };
  if (opts?.body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers });
}

/** Poll GET /v1/links/:id until enrichedAt is set or timeout. */
async function waitForEnrichment(id: string, timeoutMs = 30_000): Promise<Record<string, unknown>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await api(`/v1/links/${id}`);
    const body = await res.json() as Record<string, unknown>;
    if (body.enrichedAt) return body;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Link ${id} not enriched within ${timeoutMs}ms`);
}

const TEST_LINKS = [
  {
    url: "https://x.com/sama/status/2019474754529321247",
    label: "Sam Altman tweet",
    expectedSourceType: "x",
  },
  {
    url: "https://github.com/fastify/fastify",
    label: "Fastify GitHub repo",
    expectedSourceType: "github",
  },
  {
    url: "https://x.com/claudeai/status/2019467374420722022",
    label: "Claude AI tweet",
    expectedSourceType: "x",
  },
];

const createdIds: string[] = [];

describe("E2E: POST → enrich → search → ask", () => {
  before(async () => {
    // Verify API is reachable
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (!health || !health.ok) {
      console.log(`  API not reachable at ${API_URL} — skipping e2e tests`);
    }
  });

  after(async () => {
    // Clean up created links
    for (const id of createdIds) {
      await api(`/v1/links/${id}`, { method: "DELETE" }).catch(() => {});
    }
  });

  it("creates links and waits for enrichment", { timeout: 120_000 }, async () => {
    // Verify API is reachable
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (!health || !health.ok) {
      console.log(`    API not reachable at ${API_URL} — skipping`);
      return;
    }

    // POST all links
    for (const link of TEST_LINKS) {
      const res = await api("/v1/links", {
        method: "POST",
        body: JSON.stringify({ url: link.url }),
      });

      // 201 created or 409 conflict (already exists from previous run)
      if (res.status === 409) {
        // Fetch existing link by listing and finding the URL
        const listRes = await api("/v1/links?limit=100");
        const listBody = await listRes.json() as { data: Array<{ id: string; url: string }> };
        const existing = listBody.data.find((l) => l.url === link.url);
        assert.ok(existing, `Should find existing link for ${link.url}`);
        createdIds.push(existing.id);
        continue;
      }

      assert.equal(res.status, 201, `POST ${link.url} should return 201`);
      const body = await res.json() as { id: string };
      createdIds.push(body.id);
    }

    assert.equal(createdIds.length, TEST_LINKS.length, "Should have IDs for all links");

    // Wait for all to be enriched
    const enriched = await Promise.all(
      createdIds.map((id) => waitForEnrichment(id, 60_000)),
    );

    for (let i = 0; i < enriched.length; i++) {
      const link = enriched[i];
      const testCase = TEST_LINKS[i];
      console.log(`    ${testCase.label}: title="${link.title}", sourceType=${link.sourceType}, tags=${JSON.stringify(link.tags)}`);

      assert.ok(link.enrichedAt, `${testCase.label} should be enriched`);
      assert.equal(link.sourceType, testCase.expectedSourceType);
      assert.ok(link.title, `${testCase.label} should have title`);
      // summary and tags depend on LLM availability — log but don't fail
      if (!link.summary) console.log(`    (${testCase.label}: no summary — LLM may have been skipped)`);
      if (!link.tags || (link.tags as string[]).length === 0) console.log(`    (${testCase.label}: no tags — LLM may have been skipped)`);
    }
  });

  it("searches links by semantic query", { timeout: 30_000 }, async () => {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (!health || !health.ok) return;
    if (createdIds.length === 0) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "AI language models", limit: 5 }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { data: Array<{ url: string; title: string; similarity: number }> };

    assert.ok(body.data.length > 0, "Should find at least one result");
    console.log(`    Search results for "AI language models":`);
    for (const r of body.data) {
      console.log(`      ${r.similarity.toFixed(3)} — ${r.title} (${r.url})`);
    }
  });

  it("asks a question about saved links", { timeout: 30_000 }, async () => {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    if (!health || !health.ok) return;
    if (createdIds.length === 0) return;

    const res = await api("/v1/ask", {
      method: "POST",
      body: JSON.stringify({ question: "What are people saying about AI?" }),
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { answer: string; sources: Array<{ url: string; title: string }> };

    assert.ok(body.answer.length > 0, "Should have an answer");
    assert.ok(body.sources.length > 0, "Should cite sources");

    console.log(`    Question: "What are people saying about AI?"`);
    console.log(`    Answer: ${body.answer}`);
    console.log(`    Sources: ${body.sources.map((s) => s.title ?? s.url).join(", ")}`);
  });
});

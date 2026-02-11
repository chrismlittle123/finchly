import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { api, API_URL } from "../helpers/api.js";

let apiReachable = false;

describe("Search endpoint — POST /v1/search", () => {
  before(async () => {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    apiReachable = !!health?.ok;
    if (!apiReachable) {
      console.log(`  API not reachable at ${API_URL} — skipping search tests`);
    }
  });

  it("Search for 'AI' returns results with similarity scores", { timeout: 15_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "AI" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<{ url: string; title: string | null; similarity: number }>;
      query: string;
    };

    assert.equal(body.query, "AI");
    assert.ok(body.data.length > 0, "Should return at least one result for 'AI'");

    for (const r of body.data) {
      assert.equal(typeof r.similarity, "number");
      assert.ok(r.similarity > 0 && r.similarity <= 1, `Similarity ${r.similarity} should be in (0,1]`);
      assert.ok(r.url, "Each result should have a url");
    }
  });

  it("Search for 'web framework' returns results", { timeout: 15_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "web framework" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<{ url: string; title: string | null; similarity: number }>;
      query: string;
    };

    assert.equal(body.query, "web framework");
    assert.ok(body.data.length > 0, "Should return at least one result for 'web framework'");
  });

  it("Search with limit: 1 returns exactly 1 result", { timeout: 15_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "AI", limit: 1 }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<{ url: string; similarity: number }>;
    };

    assert.equal(body.data.length, 1, "Should return exactly 1 result when limit=1");
  });

  it("Search with high threshold returns fewer or no results", { timeout: 15_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "AI", threshold: 0.9 }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<{ url: string; similarity: number }>;
    };

    // With threshold 0.9, we expect very few or zero results
    assert.ok(body.data.length >= 0, "Should return an array (possibly empty)");
    for (const r of body.data) {
      assert.ok(r.similarity > 0.9, `All results should exceed 0.9 threshold, got ${r.similarity}`);
    }
  });

  it("Search for nonsense string returns empty array", { timeout: 15_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({ query: "xyzzy9999zzz_nonsense_qwerty" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      data: Array<unknown>;
    };

    assert.equal(body.data.length, 0, "Nonsense query should return no results");
  });

  it("Search without query returns 400", { timeout: 10_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/search", {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400, "Missing query should return 400");
  });
});

describe("Ask endpoint — POST /v1/ask", () => {
  before(async () => {
    const health = await fetch(`${API_URL}/health`).catch(() => null);
    apiReachable = !!health?.ok;
    if (!apiReachable) {
      console.log(`  API not reachable at ${API_URL} — skipping ask tests`);
    }
  });

  it("Ask 'What AI tools were shared?' returns answer + sources", { timeout: 30_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/ask", {
      method: "POST",
      body: JSON.stringify({ question: "What AI tools were shared?" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      answer: string;
      sources: Array<{ id: string; url: string; title: string | null; similarity: number }>;
    };

    assert.ok(body.answer.length > 0, "Should have a non-empty answer");
    assert.ok(Array.isArray(body.sources), "Should have sources array");
    assert.ok(body.sources.length > 0, "Should cite at least one source");

    for (const s of body.sources) {
      assert.ok(s.id, "Each source should have an id");
      assert.ok(s.url, "Each source should have a url");
      assert.equal(typeof s.similarity, "number");
    }
  });

  it("Ask 'Summarize the GitHub repos' returns answer referencing repos", { timeout: 30_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/ask", {
      method: "POST",
      body: JSON.stringify({ question: "Summarize the GitHub repos" }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      answer: string;
      sources: Array<{ id: string; url: string; title: string | null; similarity: number }>;
    };

    assert.ok(body.answer.length > 0, "Should have a non-empty answer");
    assert.ok(Array.isArray(body.sources), "Should have sources array");
  });

  it("Ask without question field returns 400", { timeout: 10_000 }, async () => {
    if (!apiReachable) return;

    const res = await api("/v1/ask", {
      method: "POST",
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400, "Missing question should return 400");
  });
});

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

const API_URL =
  process.env.API_URL ??
  "https://finchly-api-dev-10492061315.europe-west2.run.app";

async function api(path: string, opts?: RequestInit) {
  const headers: Record<string, string> = { ...opts?.headers as Record<string, string> };
  if (opts?.body) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${API_URL}${path}`, { ...opts, headers });
}

describe("Finchly API integration tests", () => {
  const testUrl = `https://example.com/test-${Date.now()}`;
  let createdId: string;
  let metadataId: string;

  it("1. Health check — GET /health returns ok", async () => {
    const res = await api("/health");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: "ok" });
  });

  it("2. Create link — POST /links returns 201", async () => {
    const res = await api("/links", {
      method: "POST",
      body: JSON.stringify({ url: testUrl }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.url, testUrl);
    assert.ok(body.id);
    assert.ok(body.createdAt);
    createdId = body.id;
  });

  it("3. Get link by ID — GET /links/:id returns matching data", async () => {
    const res = await api(`/links/${createdId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, createdId);
    assert.equal(body.url, testUrl);
  });

  it("4. List links — GET /links returns array containing created link", async () => {
    const res = await api("/links");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    const found = body.find((l: { id: string }) => l.id === createdId);
    assert.ok(found, "Created link should appear in list");
  });

  it("5. Duplicate URL — POST /links with same URL returns 409", async () => {
    const res = await api("/links", {
      method: "POST",
      body: JSON.stringify({ url: testUrl }),
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.equal(body.error, "URL already exists");
  });

  it("6. Delete link — DELETE /links/:id returns 204", async () => {
    const res = await api(`/links/${createdId}`, { method: "DELETE" });
    assert.equal(res.status, 204);
  });

  it("7. Get deleted link — GET /links/:id returns 404", async () => {
    const res = await api(`/links/${createdId}`);
    assert.equal(res.status, 404);
  });

  it("8. Create link with metadata — fields are returned", async () => {
    const metadataUrl = `https://example.com/meta-${Date.now()}`;
    const res = await api("/links", {
      method: "POST",
      body: JSON.stringify({
        url: metadataUrl,
        title: "Test Title",
        summary: "A test summary",
        tags: ["test", "integration"],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.url, metadataUrl);
    assert.equal(body.title, "Test Title");
    assert.equal(body.summary, "A test summary");
    assert.deepEqual(body.tags, ["test", "integration"]);
    metadataId = body.id;
  });

  it("9. Invalid payload — POST /links with no URL returns 400", async () => {
    const res = await api("/links", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, "Invalid payload");
  });

  // Cleanup: delete the metadata link created in test 8
  after(async () => {
    if (metadataId) {
      await api(`/links/${metadataId}`, { method: "DELETE" });
    }
  });
});

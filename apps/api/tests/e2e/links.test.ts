import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { api, API_URL } from "../helpers/api.js";

describe("Finchly API integration tests", () => {
  const testUrl = `https://example.com/test-${Date.now()}`;
  let createdId: string;
  let metadataId: string;

  it("1. Health check — GET /health returns healthy", async () => {
    const res = await fetch(`${API_URL}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
  });

  it("2. Create link — POST /v1/links returns 201", async () => {
    const res = await api("/v1/links", {
      method: "POST",
      body: JSON.stringify({ url: testUrl }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.url, testUrl);
    assert.ok(body.id);
    assert.ok(body.id.startsWith("lnk_"), "ID should have lnk_ prefix");
    assert.ok(body.createdAt);
    createdId = body.id;
  });

  it("3. Get link by ID — GET /v1/links/:id returns matching data", async () => {
    const res = await api(`/v1/links/${createdId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, createdId);
    assert.equal(body.url, testUrl);
  });

  it("4. List links — GET /v1/links returns paginated response", async () => {
    const res = await api("/v1/links");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.data), "Response should have data array");
    assert.equal(typeof body.hasMore, "boolean");
    const found = body.data.find((l: { id: string }) => l.id === createdId);
    assert.ok(found, "Created link should appear in list");
  });

  it("5. Duplicate URL — POST /v1/links with same URL returns 409", async () => {
    const res = await api("/v1/links", {
      method: "POST",
      body: JSON.stringify({ url: testUrl }),
    });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.error, "Should have error object");
    assert.equal(body.error.code, "CONFLICT");
  });

  it("6. Delete link — DELETE /v1/links/:id returns 204", async () => {
    const res = await api(`/v1/links/${createdId}`, { method: "DELETE" });
    assert.equal(res.status, 204);
  });

  it("7. Get deleted link — GET /v1/links/:id returns 404", async () => {
    const res = await api(`/v1/links/${createdId}`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
    assert.equal(body.error.code, "NOT_FOUND");
  });

  it("8. Create link with metadata — fields are returned", async () => {
    const metadataUrl = `https://example.com/meta-${Date.now()}`;
    const res = await api("/v1/links", {
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

  it("9. Unauthenticated request — returns 401", async () => {
    const res = await fetch(`${API_URL}/v1/links`);
    assert.equal(res.status, 401);
  });

  // Cleanup: delete the metadata link created in test 8
  after(async () => {
    if (metadataId) {
      await api(`/v1/links/${metadataId}`, { method: "DELETE" });
    }
  });
});

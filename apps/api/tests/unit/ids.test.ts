import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createId, linkId } from "@finchly/db";

describe("createId", () => {
  it("creates an ID with the given prefix", () => {
    const id = createId("usr");
    assert.ok(id.startsWith("usr_"));
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId("tst")));
    assert.equal(ids.size, 100);
  });
});

describe("linkId", () => {
  it("creates an ID with lnk_ prefix", () => {
    const id = linkId();
    assert.ok(id.startsWith("lnk_"));
    assert.equal(id.length, 4 + 21); // "lnk_" + 21 char nanoid
  });
});

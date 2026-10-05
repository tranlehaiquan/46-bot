import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitText } from "./split-text.js";

describe("splitText", () => {
  it("returns single item when text is within limit", () => {
    const text = "Hello family!";
    const result = splitText(text, 100);
    assert.deepEqual(result, ["Hello family!"]);
  });

  it("splits by paragraph when available", () => {
    const p1 = "A".repeat(80);
    const p2 = "B".repeat(80);
    const text = `${p1}\n\n${p2}`;
    const result = splitText(text, 100);
    assert.equal(result.length, 2);
    assert.equal(result[0], p1);
    assert.equal(result[1], p2);
  });

  it("splits by newline when paragraph is not available", () => {
    const l1 = "Line 1 is about something.";
    const l2 = "Line 2 is another thought.";
    const text = `${l1}\n${l2}`;
    const result = splitText(text, 35);
    assert.equal(result.length, 2);
    assert.equal(result[0], l1);
    assert.equal(result[1], l2);
  });

  it("splits by sentence boundary", () => {
    const text = "First sentence here. Second sentence starts now and is longer.";
    const result = splitText(text, 30);
    assert.equal(result.length > 1, true);
    assert.equal(result[0], "First sentence here.");
    for (const chunk of result) {
      assert.ok(chunk.length <= 30);
    }
  });

  it("hard splits when no whitespace exists", () => {
    const text = "X".repeat(50);
    const result = splitText(text, 20);
    assert.equal(result.length, 3);
    assert.equal(result[0].length, 20);
    assert.equal(result[1].length, 20);
    assert.equal(result[2].length, 10);
  });
});

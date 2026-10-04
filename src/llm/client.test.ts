import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./client.js";

describe("buildSystemPrompt", () => {
  it("includes default instructions and formatted Vietnam date and time", () => {
    // 2026-10-04T12:00:00.000Z corresponds to 19:00:00 in Asia/Ho_Chi_Minh (+07:00)
    const fixedDate = new Date("2026-10-04T12:00:00.000Z");
    const prompt = buildSystemPrompt(DEFAULT_SYSTEM_PROMPT, fixedDate);

    assert.ok(prompt.startsWith(DEFAULT_SYSTEM_PROMPT));
    assert.match(prompt, /Thời gian hiện tại \(Việt Nam, GMT\+7\):/);
    assert.match(prompt, /19:00:00/);
    assert.match(prompt, /4 tháng 10, 2026|04\/10\/2026/);
  });

  it("supports custom base system prompt", () => {
    const fixedDate = new Date("2026-10-04T12:00:00.000Z");
    const customPrompt = "Bạn là trợ lý cá nhân.";
    const prompt = buildSystemPrompt(customPrompt, fixedDate);

    assert.ok(prompt.startsWith(customPrompt));
    assert.match(prompt, /Thời gian hiện tại \(Việt Nam, GMT\+7\):/);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase, closeDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createSettingsRepository } from "./settings.js";

describe("SettingsRepository", () => {
  it("sets, gets, overwrites, deletes, and retrieves all settings", async () => {
    const db = openDatabase(":memory:");
    try {
      await migrate(db);
      const repo = createSettingsRepository(db);

      // Initially null
      assert.equal(await repo.get("llm_provider"), null);

      // Set value
      await repo.set("llm_provider", "gemini");
      assert.equal(await repo.get("llm_provider"), "gemini");

      // Overwrite value
      await repo.set("llm_provider", "deepseek");
      assert.equal(await repo.get("llm_provider"), "deepseek");

      // Set multiple
      await repo.setMany({
        gemini_model: "gemini-3.8-flash",
        tavily_api_key: "tvly-test",
      });

      const all = await repo.getAll();
      assert.equal(all.llm_provider, "deepseek");
      assert.equal(all.gemini_model, "gemini-3.8-flash");
      assert.equal(all.tavily_api_key, "tvly-test");

      // Delete via setMany with null
      await repo.setMany({
        tavily_api_key: null,
      });
      assert.equal(await repo.get("tavily_api_key"), null);

      // Explicit delete
      await repo.delete("gemini_model");
      assert.equal(await repo.get("gemini_model"), null);
    } finally {
      closeDatabase(db);
    }
  });
});

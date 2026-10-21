import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openDatabase, closeDatabase } from "../connection.js";
import { migrate } from "../migrations.js";
import { createSettingsRepository } from "./settings.js";
import { ENCRYPTION_PREFIX } from "../../crypto/encryption.js";

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

  it("transparently encrypts sensitive API keys at rest and preserves backward compatibility", async () => {
    const db = openDatabase(":memory:");
    const secret = "test-secret-key-46bot";
    try {
      await migrate(db);
      const repo = createSettingsRepository(db, secret);

      // Save a sensitive key and a non-sensitive key
      await repo.set("gemini_api_key", "AIzaSy-sample-key-12345");
      await repo.set("gemini_model", "gemini-3.8-flash");

      // Verify that in SQLite database, sensitive key is encrypted with prefix
      const rawRows = (
        await db.execute("SELECT key, value FROM system_settings")
      ).rows as unknown as { key: string; value: string }[];
      const rowMap = Object.fromEntries(rawRows.map((r) => [r.key, r.value]));

      assert.ok(rowMap.gemini_api_key?.startsWith(ENCRYPTION_PREFIX));
      assert.equal(rowMap.gemini_model, "gemini-3.8-flash"); // Non-sensitive remains unencrypted

      // Verify repo.get decrypts transparently
      assert.equal(await repo.get("gemini_api_key"), "AIzaSy-sample-key-12345");
      assert.equal(await repo.get("gemini_model"), "gemini-3.8-flash");

      // Verify repo.getAll decrypts transparently
      const all = await repo.getAll();
      assert.equal(all.gemini_api_key, "AIzaSy-sample-key-12345");

      // Backward compatibility: directly insert unencrypted legacy key into SQLite
      await db.execute(
        "INSERT INTO system_settings (key, value, updated_at) VALUES ('deepseek_api_key', 'sk-legacy-unencrypted-key', 123456)",
      );

      // Repo should read legacy plaintext key without failing
      assert.equal(await repo.get("deepseek_api_key"), "sk-legacy-unencrypted-key");
      const allWithLegacy = await repo.getAll();
      assert.equal(allWithLegacy.deepseek_api_key, "sk-legacy-unencrypted-key");
    } finally {
      closeDatabase(db);
    }
  });
});

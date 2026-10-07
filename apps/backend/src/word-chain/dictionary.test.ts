import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultDictionary,
  matchesChain,
  normalizePhrase,
  splitSyllables,
  WordChainDictionary,
} from "./dictionary.js";

describe("WordChainDictionary & utilities", () => {
  it("normalizes phrases to lowercase, trimmed NFC Unicode", () => {
    assert.equal(normalizePhrase("  Học   Sinh  "), "học sinh");
    // NFD composed to NFC
    const nfd = "ho\u0323c sinh"; // học sinh in decomposed form
    assert.equal(normalizePhrase(nfd), "học sinh");
  });

  it("splits exactly two syllables", () => {
    assert.deepEqual(splitSyllables("học sinh"), ["học", "sinh"]);
    assert.deepEqual(splitSyllables("  SINH   VIÊN  "), ["sinh", "viên"]);
    assert.equal(splitSyllables("học"), null);
    assert.equal(splitSyllables("trường học thân thiện"), null);
    assert.equal(splitSyllables(""), null);
  });

  it("matches chain properly based on syllable continuation", () => {
    assert.equal(matchesChain("học sinh", "sinh viên"), true);
    assert.equal(matchesChain("sinh viên", "viên chức"), true);
    assert.equal(matchesChain("học sinh", "giáo viên"), false);
    assert.equal(matchesChain("học", "học sinh"), false);
  });

  it("loads default dictionary with hundreds of valid Vietnamese words", () => {
    assert.ok(defaultDictionary.size > 500, `Expected > 500 words, got ${defaultDictionary.size}`);
    assert.equal(defaultDictionary.isValidWord("học sinh"), true);
    assert.equal(defaultDictionary.isValidWord("sinh viên"), true);
    assert.equal(defaultDictionary.isValidWord("viên phấn"), true);
    assert.equal(defaultDictionary.isValidWord("từ không có"), false);
  });

  it("supports custom dictionary instances and starter word selection", () => {
    const custom = new WordChainDictionary(["con mèo", "mèo mướp", "mướp đắng", "đắng cay"]);
    assert.equal(custom.size, 4);
    assert.equal(custom.isValidWord("con mèo"), true);
    assert.equal(custom.isValidWord("mèo mướp"), true);
    assert.equal(custom.hasContinuations("mèo"), true);
    assert.equal(custom.hasContinuations("không có"), false);

    const starter = custom.getRandomStartingWord();
    assert.ok(custom.isValidWord(starter));
    const parts = splitSyllables(starter)!;
    assert.ok(custom.hasContinuations(parts[1]));
  });
});

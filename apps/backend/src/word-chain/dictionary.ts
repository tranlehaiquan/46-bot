import { DEFAULT_VIETNAMESE_WORDS } from "./lexicon.js";

/**
 * Normalizes a Vietnamese string:
 * - Converts to NFC Unicode form
 * - Trims and lowercases
 * - Replaces repeated spaces with a single space
 */
export function normalizePhrase(text: string): string {
  if (!text) return "";
  return text
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Extracts exactly 2 syllables from a phrase.
 * Returns [firstSyllable, secondSyllable] or null if not exactly 2 syllables.
 */
export function splitSyllables(phrase: string): [string, string] | null {
  const normalized = normalizePhrase(phrase);
  if (!normalized) return null;
  const parts = normalized.split(" ");
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

/**
 * Checks if the second word continues from the first word:
 * The first syllable of `nextWord` must match the second syllable of `currentWord`.
 */
export function matchesChain(currentWord: string, nextWord: string): boolean {
  const currentParts = splitSyllables(currentWord);
  const nextParts = splitSyllables(nextWord);
  if (!currentParts || !nextParts) return false;
  return currentParts[1] === nextParts[0];
}

export class WordChainDictionary {
  private wordsSet = new Set<string>();
  private headIndex = new Map<string, Set<string>>();
  private viableStarterWords: string[] = [];

  constructor(customWords?: readonly string[]) {
    const list = customWords && customWords.length > 0 ? customWords : DEFAULT_VIETNAMESE_WORDS;
    this.addWords(list);
  }

  /**
   * Adds words to the in-memory dictionary.
   */
  public addWords(words: readonly string[]): void {
    for (const raw of words) {
      const normalized = normalizePhrase(raw);
      const syllables = splitSyllables(normalized);
      if (!syllables) continue;

      const [head, tail] = syllables;
      this.wordsSet.add(normalized);

      let headList = this.headIndex.get(head);
      if (!headList) {
        headList = new Set<string>();
        this.headIndex.set(head, headList);
      }
      headList.add(normalized);
    }

    // Recompute viable starter words (words whose tail has at least one follow-up word)
    this.viableStarterWords = [];
    for (const word of this.wordsSet) {
      const syllables = splitSyllables(word);
      if (!syllables) continue;
      const tail = syllables[1];
      const continuations = this.headIndex.get(tail);
      if (continuations && continuations.size > 0) {
        this.viableStarterWords.push(word);
      }
    }
  }

  /**
   * Returns true if the word exists in the dictionary and has 2 syllables.
   */
  public isValidWord(phrase: string): boolean {
    const normalized = normalizePhrase(phrase);
    return this.wordsSet.has(normalized);
  }

  /**
   * Checks if there are any words in the dictionary starting with the given syllable.
   */
  public hasContinuations(syllable: string): boolean {
    const normalized = normalizePhrase(syllable);
    const cont = this.headIndex.get(normalized);
    return Boolean(cont && cont.size > 0);
  }

  /**
   * Returns all possible words starting with the given syllable.
   */
  public getContinuations(syllable: string): string[] {
    const normalized = normalizePhrase(syllable);
    const cont = this.headIndex.get(normalized);
    return cont ? Array.from(cont) : [];
  }

  /**
   * Picks a random starter word that is guaranteed to have valid follow-up words.
   */
  public getRandomStartingWord(): string {
    const candidates = this.viableStarterWords.length > 0
      ? this.viableStarterWords
      : Array.from(this.wordsSet);

    if (candidates.length === 0) {
      return "học sinh";
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  /**
   * Returns total count of unique 2-syllable words loaded.
   */
  public get size(): number {
    return this.wordsSet.size;
  }
}

// Global singleton instance
export const defaultDictionary = new WordChainDictionary();

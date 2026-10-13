export type MemorySearchCandidate = {
  type: "fact" | "story";
  id: number;
  subject: string;
  content: string;
  category?: "core" | "general";
  people?: string;
  happenedOn?: string | null;
  ts: number;
};

export type ScoredMemorySearchResult = MemorySearchCandidate & {
  score: number;
};

export function removeVietnameseDiacritics(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"))
    .toLowerCase()
    .trim();
}

export function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryMatch(text: string, token: string): boolean {
  if (!text || !token) return false;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(token)}(?![\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
}

export function hasDiacritics(str: string): boolean {
  return removeVietnameseDiacritics(str) !== str.toLowerCase().trim();
}

export function scoreMemoryCandidate(
  candidate: MemorySearchCandidate,
  query: string,
  queryTokens: string[],
  normalizedQuery: string,
): number {
  let score = 0;
  const rawSubject = candidate.subject.toLowerCase();
  const rawContent = candidate.content.toLowerCase();
  const rawPeople = (candidate.people || "").toLowerCase();

  const normSubject = removeVietnameseDiacritics(candidate.subject);
  const normContent = removeVietnameseDiacritics(candidate.content);
  const normPeople = removeVietnameseDiacritics(candidate.people || "");

  const lowerQuery = query.toLowerCase().trim();
  const queryHasAccents = hasDiacritics(query);

  // 1. Whole-phrase matches
  if (rawSubject.includes(lowerQuery)) {
    score += 10.0;
  } else if (!queryHasAccents && normSubject.includes(normalizedQuery)) {
    score += 8.0;
  }

  if (rawContent.includes(lowerQuery)) {
    score += 5.0;
  } else if (!queryHasAccents && normContent.includes(normalizedQuery)) {
    score += 4.0;
  }

  if (rawPeople.includes(lowerQuery)) {
    score += 4.0;
  } else if (!queryHasAccents && normPeople.includes(normalizedQuery)) {
    score += 3.0;
  }

  // 2. Token overlap scoring using word boundaries
  let matchedTokens = 0;
  for (const token of queryTokens) {
    const tokenHasAccents = hasDiacritics(token);
    const normToken = removeVietnameseDiacritics(token);
    let tokenMatched = false;

    if (wordBoundaryMatch(rawSubject, token)) {
      score += 2.0;
      tokenMatched = true;
    } else if (!tokenHasAccents && wordBoundaryMatch(normSubject, normToken)) {
      score += 1.5;
      tokenMatched = true;
    }

    if (wordBoundaryMatch(rawContent, token)) {
      score += 1.0;
      tokenMatched = true;
    } else if (!tokenHasAccents && wordBoundaryMatch(normContent, normToken)) {
      score += 0.8;
      tokenMatched = true;
    }

    if (wordBoundaryMatch(rawPeople, token)) {
      score += 1.5;
      tokenMatched = true;
    } else if (!tokenHasAccents && wordBoundaryMatch(normPeople, normToken)) {
      score += 1.0;
      tokenMatched = true;
    }

    if (tokenMatched) {
      matchedTokens++;
    }
  }

  // If there are multiple query tokens, require meaningful token coverage
  if (queryTokens.length > 1 && matchedTokens > 0) {
    const coverageRatio = matchedTokens / queryTokens.length;
    score += coverageRatio * 3.0;
  }

  // 3. Category priority boost: core memories get extra priority
  if (candidate.type === "fact" && candidate.category === "core" && score > 0) {
    score += 1.5;
  }

  return score;
}

export function rankMemoryCandidates(
  candidates: MemorySearchCandidate[],
  query: string,
  limit = 10,
): ScoredMemorySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return candidates.slice(0, limit).map((c) => ({ ...c, score: 1.0 }));
  }

  const queryTokens = tokenize(trimmed);
  const normalizedQuery = removeVietnameseDiacritics(trimmed);

  const scored: ScoredMemorySearchResult[] = [];

  for (const candidate of candidates) {
    const score = scoreMemoryCandidate(candidate, trimmed, queryTokens, normalizedQuery);
    if (score > 0) {
      scored.push({
        ...candidate,
        score: Math.round(score * 100) / 100,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.ts - a.ts;
  });

  return scored.slice(0, limit);
}

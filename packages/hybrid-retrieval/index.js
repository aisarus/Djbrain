export async function hybridRetrieve({ query, memories, vectorScorer = null, limit = 5, now = new Date().toISOString(), diversityKey = defaultDiversityKey } = {}) {
  if (!query || typeof query.text !== 'string') throw new TypeError('query.text is required');
  const terms = tokenize([query.text, ...(query.entities ?? []), ...(query.topics ?? [])].join(' '));
  const vectorScores = vectorScorer ? await vectorScorer.score(query, memories) : new Map();

  const ranked = (memories ?? []).map((memory) => {
    const text = searchableText(memory);
    const lexical = bm25Lite(terms, tokenize(text));
    const vector = normalizeVectorScore(vectorScores instanceof Map ? vectorScores.get(memory.id) : vectorScores?.[memory.id]);
    const recency = recencyScore(memory, now);
    const confidence = memory.confidence ?? 0.5;
    const importance = memory.importance ?? 0.5;
    const current = memory.status === 'current' || memory.current === true ? 1 : 0;
    const contradictionPenalty = memory.status === 'contradicted' || memory.status === 'superseded' ? 0.35 : 0;
    const score = lexical * 0.38 + vector * 0.32 + recency * 0.08 + confidence * 0.09 + importance * 0.08 + current * 0.05 - contradictionPenalty;
    return {
      id: memory.id,
      memory,
      score: Number(Math.max(0, score).toFixed(4)),
      components: { lexical, vector, recency, confidence, importance, current, contradictionPenalty }
    };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return diversify(ranked, limit, diversityKey);
}

export function createHashVectorScorer({ dimensions = 128 } = {}) {
  return {
    async score(query, memories) {
      const q = hashVector(tokenize(`${query.text} ${(query.entities ?? []).join(' ')}`), dimensions);
      return new Map((memories ?? []).map((memory) => [memory.id, cosine(q, hashVector(tokenize(searchableText(memory)), dimensions))]));
    }
  };
}

export function evaluateRankedRetrieval(cases) {
  let reciprocalRank = 0;
  let hitAt1 = 0;
  let hitAt5 = 0;
  for (const item of cases) {
    const ids = item.results.map((result) => result.id ?? result.memory?.id);
    const rank = ids.findIndex((id) => item.relevantIds.includes(id));
    if (rank === 0) hitAt1 += 1;
    if (rank >= 0 && rank < 5) hitAt5 += 1;
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
  }
  const total = cases.length || 1;
  return {
    cases: cases.length,
    hitAt1: Number((hitAt1 / total).toFixed(4)),
    hitAt5: Number((hitAt5 / total).toFixed(4)),
    mrr: Number((reciprocalRank / total).toFixed(4))
  };
}

function bm25Lite(queryTerms, documentTerms) {
  if (!queryTerms.length || !documentTerms.length) return 0;
  const frequencies = new Map();
  for (const term of documentTerms) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
  let score = 0;
  const averageLength = 40;
  const k1 = 1.2;
  const b = 0.75;
  for (const term of new Set(queryTerms)) {
    const tf = frequencies.get(term) ?? 0;
    if (!tf) continue;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * documentTerms.length / averageLength);
    score += numerator / denominator;
  }
  return Math.min(1, score / Math.max(1, new Set(queryTerms).size));
}

function searchableText(memory) {
  return [memory.summary, memory.subject, memory.predicate, stringify(memory.value), memory.stateType, ...(memory.entities ?? []), ...(memory.topics ?? [])].filter(Boolean).join(' ');
}

function tokenize(text) {
  return String(text).toLowerCase().replace(/[«»“”"'`.,!?;:()\[\]{}]/g, ' ').split(/\s+/).map(stem).filter((token) => token.length > 1);
}

function stem(token) {
  return token.replace(/(иями|ами|ями|ого|ему|ими|ый|ий|ая|ое|ые|ов|ам|ах|ях|ом|ем|у|а|ы|и|е|я)$/u, '');
}

function hashVector(tokens, dimensions) {
  const vector = new Float64Array(dimensions);
  for (const token of tokens) {
    let hash = 2166136261;
    for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
    const position = Math.abs(hash) % dimensions;
    vector[position] += hash % 2 === 0 ? 1 : -1;
  }
  return vector;
}

function cosine(a, b) {
  let dot = 0; let an = 0; let bn = 0;
  for (let index = 0; index < a.length; index += 1) { dot += a[index] * b[index]; an += a[index] ** 2; bn += b[index] ** 2; }
  if (!an || !bn) return 0;
  return Math.max(0, dot / Math.sqrt(an * bn));
}

function recencyScore(memory, now) {
  const timestamp = memory.validFrom ?? memory.timeEnd ?? memory.timeStart ?? memory.updatedAt;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) return 0.4;
  const days = Math.max(0, (Date.parse(now) - Date.parse(timestamp)) / 86400000);
  return 1 / (1 + days / 90);
}

function normalizeVectorScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function diversify(ranked, limit, keyFn) {
  const output = [];
  const counts = new Map();
  for (const item of ranked) {
    const key = keyFn(item.memory);
    const count = counts.get(key) ?? 0;
    if (count >= 2 && ranked.length > limit) continue;
    output.push(item);
    counts.set(key, count + 1);
    if (output.length >= limit) break;
  }
  return output;
}

function defaultDiversityKey(memory) {
  return memory.layer ?? memory.predicate ?? memory.stateType ?? 'memory';
}

function stringify(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

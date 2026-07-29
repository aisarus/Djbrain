const STATUS = new Set(['candidate', 'verified', 'rejected', 'superseded']);

export function createSemanticStore(seed = []) {
  const facts = seed.map(createSemanticFact);
  return { schemaVersion: '1.0.0', facts };
}

export function createSemanticFact(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input is required');
  if (!input.subject || !input.predicate) throw new TypeError('subject and predicate are required');
  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) throw new TypeError('evidenceIds are required');
  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `fact_${crypto.randomUUID()}`,
    subject: String(input.subject),
    predicate: String(input.predicate),
    value: input.value,
    confidence: clamp(input.confidence ?? 0.5),
    evidenceIds: [...new Set(input.evidenceIds)],
    counterEvidenceIds: [...new Set(input.counterEvidenceIds ?? [])],
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    status: STATUS.has(input.status) ? input.status : 'candidate',
    supersedes: input.supersedes ?? null,
    supersededBy: input.supersededBy ?? null,
    sensitivity: input.sensitivity ?? 'private',
    provenance: input.provenance ?? { sourceType: 'episode' }
  };
}

export function upsertSemanticFact(store, input, policy = {}) {
  if (!store || !Array.isArray(store.facts)) throw new TypeError('valid semantic store required');
  const incoming = createSemanticFact(input);
  const active = store.facts.filter((fact) => fact.subject === incoming.subject && fact.predicate === incoming.predicate && !['rejected', 'superseded'].includes(fact.status));
  const exact = active.find((fact) => deepEqual(fact.value, incoming.value));
  if (exact) {
    exact.evidenceIds = [...new Set([...exact.evidenceIds, ...incoming.evidenceIds])];
    exact.confidence = clamp(Math.max(exact.confidence, incoming.confidence) + 0.03);
    return { action: 'reinforced', fact: exact, conflicts: [] };
  }

  const conflicts = active.filter((fact) => !deepEqual(fact.value, incoming.value));
  if (conflicts.length && policy.autoSupersede !== true) {
    store.facts.push(incoming);
    return { action: 'conflict_pending', fact: incoming, conflicts: conflicts.map((fact) => fact.id) };
  }

  for (const fact of conflicts) {
    fact.status = 'superseded';
    fact.validTo = incoming.validFrom ?? input.observedAt ?? null;
    fact.supersededBy = incoming.id;
  }
  if (conflicts[0]) incoming.supersedes = conflicts[0].id;
  store.facts.push(incoming);
  return { action: conflicts.length ? 'superseded' : 'inserted', fact: incoming, conflicts: conflicts.map((fact) => fact.id) };
}

export function querySemanticFacts(store, query = {}) {
  const limit = query.limit ?? 10;
  return store.facts
    .filter((fact) => !query.subject || fact.subject === query.subject)
    .filter((fact) => !query.predicate || fact.predicate === query.predicate)
    .filter((fact) => query.includeHistorical || fact.status !== 'superseded')
    .filter((fact) => !query.status || fact.status === query.status)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

export function validateSemanticStore(store) {
  const errors = [];
  if (store?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (!Array.isArray(store?.facts)) return { valid: false, errors: [...errors, 'invalid_facts'] };
  const ids = new Set();
  for (const fact of store.facts) {
    if (ids.has(fact.id)) errors.push(`duplicate_id:${fact.id}`);
    ids.add(fact.id);
    if (!fact.subject || !fact.predicate) errors.push(`invalid_fact:${fact.id}`);
    if (!fact.evidenceIds?.length) errors.push(`missing_evidence:${fact.id}`);
    if (fact.supersededBy && !store.facts.some((other) => other.id === fact.supersededBy)) errors.push(`broken_supersession:${fact.id}`);
  }
  return { valid: errors.length === 0, errors };
}

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }

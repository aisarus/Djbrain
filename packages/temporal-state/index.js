export function createTemporalStateRegistry(seed = []) {
  const registry = { schemaVersion: '1.0.0', records: [] };
  for (const record of seed) upsertTemporalState(registry, record);
  return registry;
}

export function upsertTemporalState(registry, input) {
  validateRegistry(registry);
  const record = normalizeRecord(input);
  const sameKey = registry.records.filter((item) => item.subject === record.subject && item.stateType === record.stateType);
  const active = sameKey.filter((item) => item.status === 'current');

  if (record.status === 'current') {
    for (const item of active) {
      if (item.value === record.value) {
        item.observedAt = maxIso(item.observedAt, record.observedAt);
        item.confidence = Math.max(item.confidence, record.confidence);
        item.evidenceIds = unique([...item.evidenceIds, ...record.evidenceIds]);
        return { action: 'merged', record: structuredClone(item), conflicts: [] };
      }
      item.status = 'historical';
      item.validTo = record.validFrom;
      item.supersededBy = record.id;
      record.supersedes = unique([...record.supersedes, item.id]);
    }
  }

  const conflicts = detectTemporalConflicts({ ...registry, records: [...registry.records, record] });
  registry.records.push(record);
  registry.records.sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom));
  return { action: active.length ? 'superseded' : 'inserted', record: structuredClone(record), conflicts };
}

export function resolveCurrentState(registry, subject, stateType, at = new Date().toISOString()) {
  validateRegistry(registry);
  const target = Date.parse(at);
  return registry.records
    .filter((record) => record.subject === subject && record.stateType === stateType)
    .filter((record) => Date.parse(record.validFrom) <= target)
    .filter((record) => !record.validTo || Date.parse(record.validTo) > target)
    .sort((a, b) => Date.parse(b.validFrom) - Date.parse(a.validFrom))[0] ?? null;
}

export function getStateHistory(registry, subject, stateType) {
  validateRegistry(registry);
  return registry.records
    .filter((record) => record.subject === subject && record.stateType === stateType)
    .sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom));
}

export function detectTemporalConflicts(registry) {
  validateRegistry(registry);
  const conflicts = [];
  const groups = new Map();
  for (const record of registry.records) {
    const key = `${record.subject}::${record.stateType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }

  for (const [key, records] of groups) {
    const current = records.filter((record) => record.status === 'current');
    if (current.length > 1) conflicts.push({ type: 'multiple_current_values', key, recordIds: current.map((record) => record.id) });
    for (let i = 0; i < records.length; i += 1) {
      for (let j = i + 1; j < records.length; j += 1) {
        if (overlaps(records[i], records[j]) && records[i].value !== records[j].value) {
          conflicts.push({ type: 'overlapping_incompatible_values', key, recordIds: [records[i].id, records[j].id] });
        }
      }
    }
  }
  return conflicts;
}

function normalizeRecord(input) {
  if (!input || typeof input !== 'object') throw new TypeError('temporal state input is required');
  if (!input.subject || !input.stateType) throw new TypeError('subject and stateType are required');
  if (input.value === undefined) throw new TypeError('value is required');
  const observedAt = input.observedAt ?? new Date().toISOString();
  const validFrom = input.validFrom ?? observedAt;
  if (Number.isNaN(Date.parse(observedAt)) || Number.isNaN(Date.parse(validFrom))) throw new TypeError('invalid temporal timestamp');
  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `state_${crypto.randomUUID()}`,
    subject: input.subject,
    stateType: input.stateType,
    value: input.value,
    observedAt,
    validFrom,
    validTo: input.validTo ?? null,
    status: input.status ?? 'current',
    supersedes: unique(input.supersedes ?? []),
    supersededBy: input.supersededBy ?? null,
    confidence: clamp(input.confidence ?? 0.7),
    evidenceIds: unique(input.evidenceIds ?? []),
    sensitivity: input.sensitivity ?? 'private',
    verificationStatus: input.verificationStatus ?? 'candidate'
  };
}

function overlaps(a, b) {
  const aStart = Date.parse(a.validFrom);
  const aEnd = a.validTo ? Date.parse(a.validTo) : Infinity;
  const bStart = Date.parse(b.validFrom);
  const bEnd = b.validTo ? Date.parse(b.validTo) : Infinity;
  return aStart < bEnd && bStart < aEnd;
}

function validateRegistry(registry) {
  if (!registry || registry.schemaVersion !== '1.0.0' || !Array.isArray(registry.records)) throw new TypeError('valid temporal registry is required');
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }
function maxIso(a, b) { return Date.parse(a) >= Date.parse(b) ? a : b; }

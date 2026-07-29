const TRUST = new Set(['unknown','low','medium','high']);
const ROLES = new Set(['self','partner','friend','family','colleague','authority','service','unknown']);

export function createRelationship(input) {
  if (!input?.personId) throw new TypeError('personId is required');
  return {
    schemaVersion: '1.1.0',
    personId: input.personId,
    displayName: input.displayName ?? null,
    role: ROLES.has(input.role) ? input.role : 'unknown',
    trust: TRUST.has(input.trust) ? input.trust : 'unknown',
    closeness: clamp(input.closeness ?? 0),
    validFrom: input.validFrom ?? null,
    validTo: input.validTo ?? null,
    current: input.current ?? true,
    boundaries: unique(input.boundaries ?? []),
    communicationPreferences: unique(input.communicationPreferences ?? []),
    evidenceEpisodeIds: unique(input.evidenceEpisodeIds ?? []),
    confidence: clamp(input.confidence ?? 0.5),
    sensitivity: input.sensitivity ?? 'private'
  };
}

export function createRelationshipRegistry(seed = []) {
  return { schemaVersion: '1.1.0', relationships: seed.map(createRelationship) };
}

export function upsertRelationship(registry, input, policy = {}) {
  const incoming = createRelationship(input);
  const index = registry.relationships.findIndex((item) => item.personId === incoming.personId && item.current);
  if (index === -1) {
    registry.relationships.push(incoming);
    return { action: 'created', relationship: incoming };
  }
  const current = registry.relationships[index];
  if (policy.allowOverwrite !== true && incoming.confidence < current.confidence) {
    return { action: 'rejected_lower_confidence', relationship: current };
  }
  const merged = createRelationship({
    ...current,
    ...incoming,
    boundaries: unique([...current.boundaries, ...incoming.boundaries]),
    communicationPreferences: unique([...current.communicationPreferences, ...incoming.communicationPreferences]),
    evidenceEpisodeIds: unique([...current.evidenceEpisodeIds, ...incoming.evidenceEpisodeIds]),
    confidence: Math.max(current.confidence, incoming.confidence)
  });
  registry.relationships[index] = merged;
  return { action: 'updated', relationship: merged };
}

export function selectRelationshipContext(registry, personIds = [], options = {}) {
  const limit = options.limit ?? 3;
  const scope = unique(personIds);
  if (scope.length === 0 && options.allowUnscoped !== true) return [];
  return registry.relationships
    .filter((item) => item.current)
    .filter((item) => scope.length === 0 || scope.includes(item.personId))
    .filter((item) => options.includeSensitive === true || item.sensitivity !== 'restricted')
    .sort((a, b) => b.closeness - a.closeness || b.confidence - a.confidence)
    .slice(0, limit);
}

function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

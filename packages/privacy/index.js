const SENSITIVITY_RANK = { public: 0, internal: 1, private: 2, sensitive: 3, restricted: 4 };

export function createPrivacyContext(input = {}) {
  return {
    schemaVersion: '1.1.0',
    audience: input.audience ?? 'self',
    relationshipScope: input.relationshipScope ?? 'self',
    allowedSensitivity: input.allowedSensitivity ?? 'private',
    allowRawText: input.allowRawText === true,
    allowedPersonIds: unique(input.allowedPersonIds ?? []),
    allowedLayers: input.allowedLayers ?? [
      'working_memory',
      'episodic_memory',
      'semantic_memory',
      'temporal_state',
      'identity_core',
      'relationship_model',
      'procedural_memory'
    ]
  };
}

export function filterMemoriesByPrivacy(memories, context = createPrivacyContext()) {
  const allowedRank = SENSITIVITY_RANK[context.allowedSensitivity] ?? 2;
  const allowedLayers = new Set(context.allowedLayers ?? []);
  const allowedPersonIds = new Set(context.allowedPersonIds ?? []);
  const allowed = [];
  const blocked = [];

  for (const memory of memories ?? []) {
    const layer = memory.layer ?? inferLayer(memory);
    const sensitivity = memory.sensitivity ?? 'private';
    const reasons = [];
    if (!allowedLayers.has(layer)) reasons.push('layer_not_allowed');
    if ((SENSITIVITY_RANK[sensitivity] ?? 2) > allowedRank) reasons.push('sensitivity_exceeds_scope');
    if (memory.privacyScope && !scopeAllows(memory.privacyScope, context.relationshipScope)) reasons.push('relationship_scope_mismatch');
    if (memory.personId && allowedPersonIds.size && !allowedPersonIds.has(memory.personId)) reasons.push('person_not_in_scope');
    if (memory.rawText && !context.allowRawText) reasons.push('raw_text_not_allowed');

    if (reasons.length) blocked.push({ id: memory.id ?? memory.personId, layer, reasons });
    else allowed.push(redact(memory, context));
  }

  return { schemaVersion: '1.1.0', allowed, blocked };
}

export function enforceContextPrivacy(contextBundle, privacyContext) {
  const memories = [
    ...(contextBundle.episodes ?? []).map((item) => ({ ...(item.episode ?? item), layer: 'episodic_memory' })),
    ...(contextBundle.facts ?? []).map((item) => ({ ...(item.fact ?? item), layer: 'semantic_memory' })),
    ...(contextBundle.temporalStates ?? []).map((item) => ({ ...item, layer: 'temporal_state' })),
    ...(contextBundle.identityClaims ?? []).map((item) => ({ ...(item.claim ?? item), layer: 'identity_core' })),
    ...(contextBundle.relationships ?? []).map((item) => ({ ...(item.relationship ?? item), layer: 'relationship_model' })),
    ...(contextBundle.procedures ?? []).map((item) => ({ ...(item.procedure ?? item), layer: 'procedural_memory' }))
  ];
  return filterMemoriesByPrivacy(memories, privacyContext);
}

function redact(memory, context) {
  const clone = structuredClone(memory);
  if (!context.allowRawText) delete clone.rawText;
  if (context.audience !== 'self') {
    delete clone.provenance;
    delete clone.sourceMessageIds;
    delete clone.evidenceEpisodeIds;
    delete clone.supportingPatternIds;
    delete clone.counterEvidenceIds;
  }
  return clone;
}

function inferLayer(memory) {
  if ('predicate' in memory) return 'semantic_memory';
  if ('sourceEventIds' in memory) return 'episodic_memory';
  if ('stateType' in memory) return 'temporal_state';
  if ('personId' in memory && 'role' in memory) return 'relationship_model';
  if ('trigger' in memory && Array.isArray(memory.steps)) return 'procedural_memory';
  if ('claim' in memory && 'stability' in memory) return 'identity_core';
  return 'working_memory';
}

function scopeAllows(required, actual) {
  if (required === 'self') return actual === 'self';
  if (required === 'private_relationship') return ['self','private_relationship'].includes(actual);
  return true;
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

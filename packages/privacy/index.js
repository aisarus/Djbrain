const SENSITIVITY_RANK = { public: 0, internal: 1, private: 2, sensitive: 3, restricted: 4 };

export function createPrivacyContext(input = {}) {
  return {
    schemaVersion: '1.0.0',
    audience: input.audience ?? 'self',
    relationshipScope: input.relationshipScope ?? 'self',
    allowedSensitivity: input.allowedSensitivity ?? 'private',
    allowRawText: input.allowRawText === true,
    allowedLayers: input.allowedLayers ?? ['working_memory','episodic_memory','semantic_memory','temporal_state','identity_core']
  };
}

export function filterMemoriesByPrivacy(memories, context = createPrivacyContext()) {
  const allowedRank = SENSITIVITY_RANK[context.allowedSensitivity] ?? 2;
  const allowedLayers = new Set(context.allowedLayers ?? []);
  const allowed = [];
  const blocked = [];

  for (const memory of memories ?? []) {
    const layer = memory.layer ?? inferLayer(memory);
    const sensitivity = memory.sensitivity ?? 'private';
    const reasons = [];
    if (!allowedLayers.has(layer)) reasons.push('layer_not_allowed');
    if ((SENSITIVITY_RANK[sensitivity] ?? 2) > allowedRank) reasons.push('sensitivity_exceeds_scope');
    if (memory.privacyScope && !scopeAllows(memory.privacyScope, context.relationshipScope)) reasons.push('relationship_scope_mismatch');
    if (memory.rawText && !context.allowRawText) reasons.push('raw_text_not_allowed');

    if (reasons.length) blocked.push({ id: memory.id, layer, reasons });
    else allowed.push(redact(memory, context));
  }

  return { schemaVersion: '1.0.0', allowed, blocked };
}

export function enforceContextPrivacy(contextBundle, privacyContext) {
  const memories = [
    ...(contextBundle.episodes ?? []).map((item) => ({ ...(item.episode ?? item), layer: 'episodic_memory' })),
    ...(contextBundle.facts ?? []).map((item) => ({ ...(item.fact ?? item), layer: 'semantic_memory' })),
    ...(contextBundle.temporalStates ?? []).map((item) => ({ ...item, layer: 'temporal_state' })),
    ...(contextBundle.identityClaims ?? []).map((item) => ({ ...item, layer: 'identity_core' }))
  ];
  return filterMemoriesByPrivacy(memories, privacyContext);
}

function redact(memory, context) {
  const clone = structuredClone(memory);
  if (!context.allowRawText) delete clone.rawText;
  if (context.audience !== 'self') {
    delete clone.provenance;
    delete clone.sourceMessageIds;
  }
  return clone;
}

function inferLayer(memory) {
  if ('predicate' in memory) return 'semantic_memory';
  if ('sourceEventIds' in memory) return 'episodic_memory';
  if ('stateType' in memory) return 'temporal_state';
  return 'working_memory';
}

function scopeAllows(required, actual) {
  if (required === 'self') return actual === 'self';
  if (required === 'private_relationship') return ['self','private_relationship'].includes(actual);
  return true;
}

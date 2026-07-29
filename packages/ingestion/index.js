const TYPES = new Set(['episode','semantic_fact','temporal_state','relationship','procedure','identity_claim','feedback']);

export function validateIngestionRecord(record) {
  const errors = [];
  if (!record?.id) errors.push('missing_id');
  if (!TYPES.has(record?.type)) errors.push('invalid_type');
  if (!record?.schemaVersion) errors.push('missing_schema_version');
  if (!record?.provenance?.sourceId) errors.push('missing_provenance_source');
  if (record?.confidence != null && (record.confidence < 0 || record.confidence > 1)) errors.push('invalid_confidence');
  if (record?.status === 'verified' && record?.verification?.reviewedBy == null) errors.push('verified_without_reviewer');
  if (record?.sensitivity === 'restricted' && record?.privacy?.allowedScopes?.length === 0) errors.push('restricted_without_scope');
  return { valid: errors.length === 0, errors };
}

export function ingestBatch(records, options = {}) {
  const accepted = [];
  const quarantined = [];
  const seen = new Set();
  for (const record of records ?? []) {
    const validation = validateIngestionRecord(record);
    if (seen.has(record?.id)) validation.errors.push('duplicate_id');
    seen.add(record?.id);
    if (validation.errors.length) {
      quarantined.push({ record, errors: validation.errors });
      continue;
    }
    if (options.allowedTypes && !options.allowedTypes.includes(record.type)) {
      quarantined.push({ record, errors: ['type_not_allowed_in_batch'] });
      continue;
    }
    accepted.push(structuredClone(record));
  }
  return {
    schemaVersion: '1.0.0',
    accepted,
    quarantined,
    stats: {
      total: (records ?? []).length,
      accepted: accepted.length,
      quarantined: quarantined.length,
      acceptanceRate: records?.length ? accepted.length / records.length : 0
    }
  };
}

export function createIngestionManifest(batch, metadata = {}) {
  return {
    schemaVersion: '1.0.0',
    batchId: metadata.batchId ?? `batch_${crypto.randomUUID()}`,
    createdAt: metadata.createdAt ?? new Date().toISOString(),
    sourceArtifacts: metadata.sourceArtifacts ?? [],
    counts: batch.stats,
    acceptedIds: batch.accepted.map((item) => item.id),
    quarantined: batch.quarantined.map((item) => ({ id: item.record?.id ?? null, errors: item.errors }))
  };
}

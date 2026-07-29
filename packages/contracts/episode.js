const STATUS = new Set(['candidate','verified','quarantined']);

export function createEpisode(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  if (!Array.isArray(input.sourceEventIds) || input.sourceEventIds.length === 0) throw new TypeError('sourceEventIds are required');
  if (!input.timeStart || Number.isNaN(Date.parse(input.timeStart))) throw new TypeError('timeStart must be ISO-compatible');
  const timeEnd = input.timeEnd ?? input.timeStart;
  if (Number.isNaN(Date.parse(timeEnd))) throw new TypeError('timeEnd must be ISO-compatible');
  if (Date.parse(timeEnd) < Date.parse(input.timeStart)) throw new TypeError('timeEnd precedes timeStart');

  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `episode_${crypto.randomUUID()}`,
    sourceEventIds: [...new Set(input.sourceEventIds)],
    timeStart: input.timeStart,
    timeEnd,
    participants: [...new Set(input.participants ?? ['user','assistant'])],
    topics: [...new Set(input.topics ?? [])],
    entities: [...new Set(input.entities ?? [])],
    summary: String(input.summary ?? '').trim(),
    outcome: input.outcome ?? null,
    importance: clamp(input.importance ?? 0.5),
    novelty: clamp(input.novelty ?? 0.5),
    correctionStrength: clamp(input.correctionStrength ?? 0),
    emotionalIntensity: clamp(input.emotionalIntensity ?? 0),
    confidence: clamp(input.confidence ?? 0.5),
    sensitivity: input.sensitivity ?? 'private',
    previousEpisodeId: input.previousEpisodeId ?? null,
    nextEpisodeId: input.nextEpisodeId ?? null,
    status: STATUS.has(input.status) ? input.status : 'candidate',
    provenance: input.provenance ?? { sourceType: 'cognitive_event' }
  };
}

export function validateEpisode(episode) {
  const errors = [];
  if (episode?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (!episode?.id) errors.push('missing_id');
  if (!Array.isArray(episode?.sourceEventIds) || episode.sourceEventIds.length === 0) errors.push('missing_source_events');
  if (Number.isNaN(Date.parse(episode?.timeStart))) errors.push('invalid_time_start');
  if (Number.isNaN(Date.parse(episode?.timeEnd))) errors.push('invalid_time_end');
  if (Date.parse(episode?.timeEnd) < Date.parse(episode?.timeStart)) errors.push('invalid_time_order');
  if (typeof episode?.importance !== 'number' || episode.importance < 0 || episode.importance > 1) errors.push('invalid_importance');
  return { valid: errors.length === 0, errors };
}

function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }

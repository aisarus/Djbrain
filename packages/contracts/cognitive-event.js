const SPEECH_ACTS = new Set(['request','question','decision','correction','statement','feedback','greeting','unknown']);

export function createCognitiveEvent(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  if (typeof input.text !== 'string' || input.text.trim() === '') throw new TypeError('text is required');
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new TypeError('timestamp must be ISO-compatible');

  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `evt_${crypto.randomUUID()}`,
    timestamp,
    source: input.source ?? 'chat',
    actorId: input.actorId ?? 'user',
    text: input.text.trim(),
    language: input.language ?? 'und',
    intent: input.intent ?? 'unknown',
    speechAct: SPEECH_ACTS.has(input.speechAct) ? input.speechAct : 'unknown',
    entities: Array.isArray(input.entities) ? [...new Set(input.entities)] : [],
    explicitRequests: Array.isArray(input.explicitRequests) ? [...input.explicitRequests] : [],
    decisions: Array.isArray(input.decisions) ? [...input.decisions] : [],
    corrections: Array.isArray(input.corrections) ? [...input.corrections] : [],
    tone: input.tone ?? 'neutral',
    confidence: clamp(input.confidence ?? 0.5),
    provenance: input.provenance ?? { sourceType: 'direct_message' }
  };
}

export function validateCognitiveEvent(event) {
  const errors = [];
  if (event?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (!event?.id) errors.push('missing_id');
  if (!event?.text) errors.push('missing_text');
  if (Number.isNaN(Date.parse(event?.timestamp))) errors.push('invalid_timestamp');
  if (!Array.isArray(event?.entities)) errors.push('invalid_entities');
  if (typeof event?.confidence !== 'number' || event.confidence < 0 || event.confidence > 1) errors.push('invalid_confidence');
  return { valid: errors.length === 0, errors };
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value)));
}

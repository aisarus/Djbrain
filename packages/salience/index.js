const IMPORTANT_ACTS = new Set(['decision','correction','feedback']);

export function scoreSalience(event, context = {}) {
  if (!event) throw new TypeError('event is required');
  let importance = 0.18;
  let novelty = 0.5;
  let correctionStrength = 0;
  let emotionalIntensity = event.tone === 'intense_direct' ? 0.8 : event.tone === 'positive' ? 0.4 : 0.2;

  if (IMPORTANT_ACTS.has(event.speechAct)) importance += 0.35;
  if (event.decisions?.length) importance += 0.18;
  if (event.corrections?.length) {
    importance += 0.2;
    correctionStrength = 0.9;
  }
  if (event.entities?.length >= 2) importance += 0.08;
  if (event.uncertainty > 0.45) importance -= 0.12;
  if (event.quoted) importance -= 0.08;
  if (context.activeEntities?.length) {
    const overlap = event.entities.filter((entity) => context.activeEntities.includes(entity)).length;
    novelty = clamp(0.72 - overlap * 0.14);
  }

  const writeScore = clamp(importance * 0.55 + novelty * 0.25 + correctionStrength * 0.15 + emotionalIntensity * 0.05);
  return {
    schemaVersion: '1.0.0',
    importance: clamp(importance),
    novelty,
    correctionStrength,
    emotionalIntensity,
    writeScore,
    shouldWrite: writeScore >= 0.42,
    reason: explain(event, writeScore)
  };
}

function explain(event, score) {
  if (event.speechAct === 'correction') return 'explicit_correction';
  if (event.speechAct === 'decision') return 'project_or_behavior_decision';
  if (score < 0.42) return 'low_value_transient_event';
  return 'contextually_relevant_event';
}

function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }

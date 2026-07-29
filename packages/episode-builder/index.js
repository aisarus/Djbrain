import { createEpisode } from '../contracts/episode.js';
import { scoreSalience } from '../salience/index.js';

export function buildEpisodes(events, options = {}) {
  const maxGapMs = options.maxGapMs ?? 20 * 60 * 1000;
  const minWriteScore = options.minWriteScore ?? 0.42;
  const ordered = [...events]
    .filter(Boolean)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const groups = [];
  for (const event of ordered) {
    const salience = scoreSalience(event, { activeEntities: groups.at(-1)?.entities ?? [] });
    if (salience.writeScore < minWriteScore && !groups.length) continue;

    const current = groups.at(-1);
    if (!current || !belongsToCurrent(current, event, maxGapMs)) {
      groups.push(startGroup(event, salience));
    } else {
      extendGroup(current, event, salience);
    }
  }

  return groups.map(toEpisode);
}

function belongsToCurrent(group, event, maxGapMs) {
  const gap = Date.parse(event.timestamp) - Date.parse(group.timeEnd);
  if (gap < 0 || gap > maxGapMs) return false;
  const entityOverlap = overlap(group.entities, event.entities ?? []);
  const sameIntentFamily = intentFamily(group.lastIntent) === intentFamily(event.intent);
  const explicitContinuation = /^(да|и|ещ[её]|продолж|тогда|короче|так вот)\b/i.test(event.text ?? '');
  const correctionOfPrevious = event.speechAct === 'correction';
  return entityOverlap > 0 || sameIntentFamily || explicitContinuation || correctionOfPrevious;
}

function startGroup(event, salience) {
  return {
    sourceEventIds: [event.id],
    timeStart: event.timestamp,
    timeEnd: event.timestamp,
    participants: [event.actorId ?? 'user'],
    events: [event],
    entities: [...(event.entities ?? [])],
    intents: [event.intent],
    lastIntent: event.intent,
    importance: salience.importance,
    novelty: salience.novelty,
    correctionStrength: salience.correctionStrength,
    emotionalIntensity: salience.emotionalIntensity,
    confidenceTotal: event.confidence ?? 0.5
  };
}

function extendGroup(group, event, salience) {
  group.sourceEventIds.push(event.id);
  group.timeEnd = event.timestamp;
  group.participants = unique([...group.participants, event.actorId ?? 'user']);
  group.events.push(event);
  group.entities = unique([...group.entities, ...(event.entities ?? [])]);
  group.intents = unique([...group.intents, event.intent]);
  group.lastIntent = event.intent;
  group.importance = Math.max(group.importance, salience.importance);
  group.novelty = Math.max(group.novelty, salience.novelty);
  group.correctionStrength = Math.max(group.correctionStrength, salience.correctionStrength);
  group.emotionalIntensity = Math.max(group.emotionalIntensity, salience.emotionalIntensity);
  group.confidenceTotal += event.confidence ?? 0.5;
}

function toEpisode(group) {
  const decisive = [...group.events].reverse().find((event) => ['decision', 'correction', 'feedback'].includes(event.speechAct));
  return createEpisode({
    sourceEventIds: group.sourceEventIds,
    timeStart: group.timeStart,
    timeEnd: group.timeEnd,
    participants: group.participants,
    topics: inferTopics(group),
    entities: group.entities,
    summary: summarizeGroup(group),
    outcome: inferOutcome(decisive),
    importance: group.importance,
    novelty: group.novelty,
    correctionStrength: group.correctionStrength,
    emotionalIntensity: group.emotionalIntensity,
    confidence: group.confidenceTotal / group.events.length,
    sensitivity: 'private',
    status: 'candidate',
    provenance: { sourceType: 'event_sequence', eventIds: group.sourceEventIds }
  });
}

function inferTopics(group) {
  const topics = [];
  if (group.entities.some((entity) => ['Djbrain', 'backend'].includes(entity))) topics.push('djbrain_backend');
  if (group.entities.includes('data_pipeline')) topics.push('cognitive_data');
  if (group.intents.includes('correct_previous_behavior')) topics.push('behavior_correction');
  if (group.intents.includes('set_project_direction')) topics.push('decision');
  return topics;
}

function summarizeGroup(group) {
  const first = group.events[0]?.text ?? '';
  const last = group.events.at(-1)?.text ?? '';
  if (group.events.length === 1) return first;
  return `${first} → ${last}`;
}

function inferOutcome(event) {
  if (!event) return null;
  if (event.speechAct === 'decision') return 'direction_set';
  if (event.speechAct === 'correction') return 'behavior_constraint_added';
  if (event.speechAct === 'feedback') return 'feedback_recorded';
  return null;
}

function overlap(a, b) {
  const set = new Set(a);
  return b.filter((value) => set.has(value)).length;
}

function intentFamily(intent) {
  if (['set_project_direction', 'request_action'].includes(intent)) return 'action';
  if (['correct_previous_behavior', 'evaluate_previous_output'].includes(intent)) return 'repair';
  return intent;
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

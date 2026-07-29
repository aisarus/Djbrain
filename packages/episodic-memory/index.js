import { createEpisode, validateEpisode } from '../contracts/episode.js';
import { scoreSalience } from '../salience/index.js';

export function createEpisodeStore(seed = []) {
  const episodes = seed.map((episode) => createEpisode(episode));
  linkTemporalNeighbors(episodes);
  return { schemaVersion: '1.0.0', episodes };
}

export function writeEventToEpisodeStore(store, event, context = {}, options = {}) {
  if (!store || !Array.isArray(store.episodes)) throw new TypeError('valid store is required');
  const salience = scoreSalience(event, context);
  if (!salience.shouldWrite && options.force !== true) {
    return { store, written: false, salience, episode: null };
  }

  const episode = createEpisode({
    sourceEventIds: [event.id],
    timeStart: event.timestamp,
    timeEnd: event.timestamp,
    participants: [event.actorId ?? 'user'],
    topics: inferTopics(event),
    entities: event.entities,
    summary: summarize(event),
    outcome: inferOutcome(event),
    importance: salience.importance,
    novelty: salience.novelty,
    correctionStrength: salience.correctionStrength,
    emotionalIntensity: salience.emotionalIntensity,
    confidence: event.confidence,
    sensitivity: options.sensitivity ?? 'private',
    status: options.status ?? 'candidate',
    provenance: { sourceType: 'cognitive_event', eventId: event.id }
  });

  const next = { ...store, episodes: [...store.episodes, episode] };
  linkTemporalNeighbors(next.episodes);
  return { store: next, written: true, salience, episode };
}

export function retrieveEpisodes(store, query = {}) {
  if (!store || !Array.isArray(store.episodes)) throw new TypeError('valid store is required');
  const limit = query.limit ?? 5;
  const now = query.now ? Date.parse(query.now) : Date.now();
  const requestedEntities = query.entities ?? [];
  const requestedTopics = query.topics ?? [];

  return store.episodes
    .filter((episode) => !query.status || episode.status === query.status)
    .filter((episode) => !query.from || Date.parse(episode.timeStart) >= Date.parse(query.from))
    .filter((episode) => !query.to || Date.parse(episode.timeEnd) <= Date.parse(query.to))
    .map((episode) => ({ episode, score: relevanceScore(episode, requestedEntities, requestedTopics, now) }))
    .filter(({ score }) => score > 0 || (!requestedEntities.length && !requestedTopics.length))
    .sort((a, b) => b.score - a.score || Date.parse(b.episode.timeStart) - Date.parse(a.episode.timeStart))
    .slice(0, limit);
}

export function validateEpisodeStore(store) {
  const errors = [];
  if (store?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (!Array.isArray(store?.episodes)) return { valid: false, errors: [...errors, 'invalid_episodes'] };
  const ids = new Set();
  for (const episode of store.episodes) {
    const validation = validateEpisode(episode);
    errors.push(...validation.errors.map((error) => `${episode.id}:${error}`));
    if (ids.has(episode.id)) errors.push(`duplicate_id:${episode.id}`);
    ids.add(episode.id);
  }
  return { valid: errors.length === 0, errors };
}

function relevanceScore(episode, entities, topics, now) {
  const entityOverlap = overlap(episode.entities, entities);
  const topicOverlap = overlap(episode.topics, topics);
  const ageDays = Math.max(0, (now - Date.parse(episode.timeEnd)) / 86400000);
  const recency = 1 / (1 + ageDays / 30);
  return entityOverlap * 0.42 + topicOverlap * 0.28 + episode.importance * 0.2 + recency * 0.1;
}

function overlap(values, requested) {
  if (!requested.length) return 0;
  return values.filter((value) => requested.includes(value)).length / requested.length;
}

function inferTopics(event) {
  const topics = [];
  if (event.entities.includes('Djbrain') || event.entities.includes('backend')) topics.push('djbrain_backend');
  if (event.entities.includes('data_pipeline')) topics.push('cognitive_data');
  if (event.speechAct === 'correction') topics.push('behavior_correction');
  if (event.speechAct === 'decision') topics.push('decision');
  return topics;
}

function summarize(event) {
  if (event.speechAct === 'decision') return `Decision: ${event.decisions[0] ?? event.text}`;
  if (event.speechAct === 'correction') return `Correction: ${event.corrections[0] ?? event.text}`;
  return `${event.speechAct}: ${event.text}`;
}

function inferOutcome(event) {
  if (event.speechAct === 'decision') return 'direction_set';
  if (event.speechAct === 'correction') return 'behavior_constraint_added';
  return null;
}

function linkTemporalNeighbors(episodes) {
  episodes.sort((a, b) => Date.parse(a.timeStart) - Date.parse(b.timeStart));
  episodes.forEach((episode, index) => {
    episode.previousEpisodeId = episodes[index - 1]?.id ?? null;
    episode.nextEpisodeId = episodes[index + 1]?.id ?? null;
  });
}

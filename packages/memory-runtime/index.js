import { createWorkingMemory, updateWorkingMemory } from '../working-memory/index.js';
import { interpretMessage } from '../perception/index.js';
import { buildSituationModel } from '../situation-model/index.js';
import { routeMemory } from '../memory-router/index.js';
import { scoreSalience } from '../salience/index.js';
import { createEpisodeStore, writeEventToEpisodeStore, retrieveEpisodes } from '../episodic-memory/index.js';
import { createSemanticFact, createSemanticStore, upsertSemanticFact, querySemanticFacts } from '../semantic-memory/index.js';
import { createTemporalStateRegistry, upsertTemporalState, resolveCurrentState, getStateHistory } from '../temporal-state/index.js';
import { hybridRetrieve } from '../hybrid-retrieval/index.js';

export class MemoryRuntime {
  constructor({
    eventStore,
    snapshotStore = null,
    semanticLogStore = null,
    temporalLogStore = null,
    vectorScorer = null,
    clock = () => new Date().toISOString(),
    semanticSeed = [],
    temporalSeed = []
  } = {}) {
    if (!eventStore) throw new TypeError('eventStore is required');
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.semanticLogStore = semanticLogStore;
    this.temporalLogStore = temporalLogStore;
    this.vectorScorer = vectorScorer;
    this.clock = clock;
    this.semanticSeed = structuredClone(semanticSeed);
    this.temporalSeed = structuredClone(temporalSeed);
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.semanticStore = createSemanticStore(this.semanticSeed);
    this.temporalRegistry = createTemporalStateRegistry(this.temporalSeed);
    this.seenEventIds = new Set();
    this.seenSemanticMutationIds = new Set();
    this.seenTemporalMutationIds = new Set();
  }

  async init() {
    const { records, errors } = await this.eventStore.readAll();
    if (errors.length) throw new Error(`event_log_corrupt:${JSON.stringify(errors)}`);
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.semanticStore = createSemanticStore(this.semanticSeed);
    this.temporalRegistry = createTemporalStateRegistry(this.temporalSeed);
    this.seenEventIds.clear();
    this.seenSemanticMutationIds.clear();
    this.seenTemporalMutationIds.clear();
    for (const envelope of records) this.#replay(envelope);

    await this.#replayMutationStore(this.semanticLogStore, 'semantic_log_corrupt', (mutation) => this.#replaySemanticMutation(mutation));
    await this.#replayMutationStore(this.temporalLogStore, 'temporal_log_corrupt', (mutation) => this.#replayTemporalMutation(mutation));
    return this;
  }

  async process(input) {
    const event = interpretMessage({
      ...(typeof input === 'string' ? { text: input } : input),
      timestamp: typeof input === 'object' && input.timestamp ? input.timestamp : this.clock()
    });

    if (this.seenEventIds.has(event.id)) return { duplicate: true, eventId: event.id, state: this.getState() };

    const previous = structuredClone(this.workingMemory);
    const nextWorkingMemory = updateWorkingMemory(previous, event);
    const situation = buildSituationModel(event, nextWorkingMemory);
    const memoryDecision = routeMemory(event, situation, nextWorkingMemory);
    const salience = scoreSalience(event, { activeEntities: previous.activeEntities });

    const envelope = {
      id: `log_${event.id}`,
      schemaVersion: '1.0.0',
      type: 'cognitive_turn',
      timestamp: event.timestamp,
      event,
      workingMemoryBeforeVersion: previous.version,
      workingMemoryAfter: nextWorkingMemory,
      situation,
      memoryDecision,
      salience
    };

    await this.eventStore.append(envelope);
    this.#replay(envelope);
    const retrieval = memoryDecision.memoryNeeded
      ? await this.#retrieveForEvent(event, memoryDecision)
      : { episodes: [], facts: [], temporalStates: [], ranked: [] };
    await this.#writeSnapshot();

    return {
      duplicate: false,
      event,
      situation,
      memoryDecision,
      salience,
      retrievedEpisodes: retrieval.episodes,
      retrievedFacts: retrieval.facts,
      temporalStates: retrieval.temporalStates,
      retrievalTrace: retrieval.ranked.map(({ id, score, components, memory }) => ({ id, layer: memory.layer, score, components })),
      state: this.getState()
    };
  }

  async addSemanticFact(input, policy = {}) {
    const canonical = createSemanticFact(input);
    const mutation = {
      id: `semantic_mutation_${canonical.id}_${crypto.randomUUID()}`,
      schemaVersion: '1.0.0',
      type: 'semantic_upsert',
      timestamp: this.clock(),
      fact: canonical,
      policy: sanitizeSemanticPolicy(policy)
    };
    const result = upsertSemanticFact(this.semanticStore, canonical, policy);
    mutation.result = { action: result.action, factId: result.fact.id, conflicts: result.conflicts };
    if (this.semanticLogStore) await this.semanticLogStore.append(mutation);
    this.seenSemanticMutationIds.add(mutation.id);
    await this.#writeSnapshot();
    return result;
  }

  async addTemporalState(input) {
    const mutationId = `temporal_mutation_${input.id ?? crypto.randomUUID()}_${crypto.randomUUID()}`;
    const result = upsertTemporalState(this.temporalRegistry, input);
    const mutation = {
      id: mutationId,
      schemaVersion: '1.0.0',
      type: 'temporal_upsert',
      timestamp: this.clock(),
      record: structuredClone(result.record),
      result: { action: result.action, conflicts: result.conflicts }
    };
    if (this.temporalLogStore) await this.temporalLogStore.append(mutation);
    this.seenTemporalMutationIds.add(mutation.id);
    await this.#writeSnapshot();
    return result;
  }

  resolveTemporalState(subject, stateType, at = this.clock()) {
    return resolveCurrentState(this.temporalRegistry, subject, stateType, at);
  }

  queryMemory(query = {}) {
    const temporalQuery = query.temporal ?? {};
    return {
      episodes: retrieveEpisodes(this.episodeStore, query.episodes ?? query),
      facts: querySemanticFacts(this.semanticStore, query.facts ?? query),
      temporalStates: temporalQuery.subject && temporalQuery.stateType
        ? getStateHistory(this.temporalRegistry, temporalQuery.subject, temporalQuery.stateType)
        : structuredClone(this.temporalRegistry.records)
    };
  }

  getState() {
    return {
      schemaVersion: '1.4.0',
      workingMemory: structuredClone(this.workingMemory),
      episodes: structuredClone(this.episodeStore.episodes),
      semanticFacts: structuredClone(this.semanticStore.facts),
      temporalStates: structuredClone(this.temporalRegistry.records),
      episodeCount: this.episodeStore.episodes.length,
      semanticFactCount: this.semanticStore.facts.length,
      temporalStateCount: this.temporalRegistry.records.length,
      eventCount: this.seenEventIds.size,
      semanticMutationCount: this.seenSemanticMutationIds.size,
      temporalMutationCount: this.seenTemporalMutationIds.size
    };
  }

  async #retrieveForEvent(event, memoryDecision) {
    const memories = [
      ...this.episodeStore.episodes.map((episode) => ({ ...episode, layer: 'episodic_memory' })),
      ...this.semanticStore.facts.map((fact) => ({ ...fact, layer: 'semantic_memory' })),
      ...this.temporalRegistry.records.map((record) => ({ ...record, layer: 'temporal_state' }))
    ];
    const ranked = await hybridRetrieve({
      query: { text: event.text, entities: event.entities, topics: inferQueryTopics(event, memoryDecision) },
      memories,
      vectorScorer: this.vectorScorer,
      limit: memoryDecision.budget || 5,
      now: event.timestamp,
      minRelevance: 0.05
    });
    return {
      ranked,
      episodes: ranked.filter((item) => item.memory.layer === 'episodic_memory').map((item) => wrapRanked('episode', item)),
      facts: ranked.filter((item) => item.memory.layer === 'semantic_memory').map((item) => wrapRanked('fact', item)),
      temporalStates: ranked.filter((item) => item.memory.layer === 'temporal_state').map((item) => ({ ...item.memory, retrievalScore: item.score }))
    };
  }

  #replay(envelope) {
    if (!envelope?.event?.id || this.seenEventIds.has(envelope.event.id)) return;
    this.workingMemory = envelope.workingMemoryAfter ?? updateWorkingMemory(this.workingMemory, envelope.event);
    const result = writeEventToEpisodeStore(
      this.episodeStore,
      envelope.event,
      { activeEntities: this.workingMemory.activeEntities },
      { force: envelope.salience?.shouldWrite === true }
    );
    this.episodeStore = result.store;
    this.seenEventIds.add(envelope.event.id);
  }

  #replaySemanticMutation(mutation) {
    if (!mutation?.id || this.seenSemanticMutationIds.has(mutation.id)) return;
    if (mutation.type !== 'semantic_upsert' || !mutation.fact) throw new Error(`invalid_semantic_mutation:${mutation.id}`);
    upsertSemanticFact(this.semanticStore, mutation.fact, mutation.policy ?? {});
    this.seenSemanticMutationIds.add(mutation.id);
  }

  #replayTemporalMutation(mutation) {
    if (!mutation?.id || this.seenTemporalMutationIds.has(mutation.id)) return;
    if (mutation.type !== 'temporal_upsert' || !mutation.record) throw new Error(`invalid_temporal_mutation:${mutation.id}`);
    upsertTemporalState(this.temporalRegistry, mutation.record);
    this.seenTemporalMutationIds.add(mutation.id);
  }

  async #replayMutationStore(store, errorCode, replay) {
    if (!store) return;
    const log = await store.readAll();
    if (log.errors.length) throw new Error(`${errorCode}:${JSON.stringify(log.errors)}`);
    for (const mutation of log.records) replay(mutation);
  }

  async #writeSnapshot() {
    if (!this.snapshotStore) return;
    await this.snapshotStore.append({
      id: `runtime_state_${this.workingMemory.version}_${this.seenSemanticMutationIds.size}_${this.seenTemporalMutationIds.size}`,
      schemaVersion: '1.4.0',
      timestamp: this.clock(),
      state: this.getState()
    });
  }
}

function wrapRanked(key, item) {
  return { [key]: item.memory, score: item.score, components: item.components };
}

function inferQueryTopics(event, decision) {
  const topics = [];
  if (decision.category === 'project') topics.push('djbrain_backend','project');
  if (decision.category === 'correction') topics.push('behavior_correction','feedback');
  if (decision.category === 'feedback') topics.push('feedback');
  if (decision.category === 'relationship') topics.push('relationship');
  if (event.entities.includes('data_pipeline')) topics.push('cognitive_data');
  return topics;
}

function sanitizeSemanticPolicy(policy) {
  return { autoSupersede: policy.autoSupersede === true };
}

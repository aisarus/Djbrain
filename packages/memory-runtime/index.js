import { createWorkingMemory, updateWorkingMemory } from '../working-memory/index.js';
import { interpretMessage } from '../perception/index.js';
import { buildSituationModel } from '../situation-model/index.js';
import { routeMemory } from '../memory-router/index.js';
import { scoreSalience } from '../salience/index.js';
import { createEpisodeStore, writeEventToEpisodeStore, retrieveEpisodes } from '../episodic-memory/index.js';
import { createSemanticFact, createSemanticStore, upsertSemanticFact, querySemanticFacts } from '../semantic-memory/index.js';
import { hybridRetrieve } from '../hybrid-retrieval/index.js';

export class MemoryRuntime {
  constructor({
    eventStore,
    snapshotStore = null,
    semanticLogStore = null,
    vectorScorer = null,
    clock = () => new Date().toISOString(),
    semanticSeed = []
  } = {}) {
    if (!eventStore) throw new TypeError('eventStore is required');
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.semanticLogStore = semanticLogStore;
    this.vectorScorer = vectorScorer;
    this.clock = clock;
    this.semanticSeed = structuredClone(semanticSeed);
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.semanticStore = createSemanticStore(this.semanticSeed);
    this.seenEventIds = new Set();
    this.seenSemanticMutationIds = new Set();
  }

  async init() {
    const { records, errors } = await this.eventStore.readAll();
    if (errors.length) throw new Error(`event_log_corrupt:${JSON.stringify(errors)}`);
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.semanticStore = createSemanticStore(this.semanticSeed);
    this.seenEventIds.clear();
    this.seenSemanticMutationIds.clear();
    for (const envelope of records) this.#replay(envelope);

    if (this.semanticLogStore) {
      const semanticLog = await this.semanticLogStore.readAll();
      if (semanticLog.errors.length) throw new Error(`semantic_log_corrupt:${JSON.stringify(semanticLog.errors)}`);
      for (const mutation of semanticLog.records) this.#replaySemanticMutation(mutation);
    }
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
      : { episodes: [], facts: [], ranked: [] };
    await this.#writeSnapshot();

    return {
      duplicate: false,
      event,
      situation,
      memoryDecision,
      salience,
      retrievedEpisodes: retrieval.episodes,
      retrievedFacts: retrieval.facts,
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
      policy: sanitizePolicy(policy)
    };
    const result = upsertSemanticFact(this.semanticStore, canonical, policy);
    mutation.result = { action: result.action, factId: result.fact.id, conflicts: result.conflicts };
    if (this.semanticLogStore) await this.semanticLogStore.append(mutation);
    this.seenSemanticMutationIds.add(mutation.id);
    await this.#writeSnapshot();
    return result;
  }

  queryMemory(query = {}) {
    return {
      episodes: retrieveEpisodes(this.episodeStore, query.episodes ?? query),
      facts: querySemanticFacts(this.semanticStore, query.facts ?? query)
    };
  }

  getState() {
    return {
      schemaVersion: '1.3.0',
      workingMemory: structuredClone(this.workingMemory),
      episodes: structuredClone(this.episodeStore.episodes),
      semanticFacts: structuredClone(this.semanticStore.facts),
      episodeCount: this.episodeStore.episodes.length,
      semanticFactCount: this.semanticStore.facts.length,
      eventCount: this.seenEventIds.size,
      semanticMutationCount: this.seenSemanticMutationIds.size
    };
  }

  async #retrieveForEvent(event, memoryDecision) {
    const memories = [
      ...this.episodeStore.episodes.map((episode) => ({ ...episode, layer: 'episodic_memory' })),
      ...this.semanticStore.facts.map((fact) => ({ ...fact, layer: 'semantic_memory' }))
    ];
    const ranked = await hybridRetrieve({
      query: {
        text: event.text,
        entities: event.entities,
        topics: inferQueryTopics(event, memoryDecision)
      },
      memories,
      vectorScorer: this.vectorScorer,
      limit: memoryDecision.budget || 5,
      now: event.timestamp,
      minRelevance: 0.05
    });
    return {
      ranked,
      episodes: ranked
        .filter((item) => item.memory.layer === 'episodic_memory')
        .map((item) => ({ episode: item.memory, score: item.score, components: item.components })),
      facts: ranked
        .filter((item) => item.memory.layer === 'semantic_memory')
        .map((item) => ({ fact: item.memory, score: item.score, components: item.components }))
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

  async #writeSnapshot() {
    if (!this.snapshotStore) return;
    await this.snapshotStore.append({
      id: `runtime_state_${this.workingMemory.version}_${this.seenSemanticMutationIds.size}`,
      schemaVersion: '1.3.0',
      timestamp: this.clock(),
      state: this.getState()
    });
  }
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

function sanitizePolicy(policy) {
  return { autoSupersede: policy.autoSupersede === true };
}

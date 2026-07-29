import { createWorkingMemory, updateWorkingMemory } from '../working-memory/index.js';
import { interpretMessage } from '../perception/index.js';
import { buildSituationModel } from '../situation-model/index.js';
import { routeMemory } from '../memory-router/index.js';
import { scoreSalience } from '../salience/index.js';
import { createEpisodeStore, writeEventToEpisodeStore, retrieveEpisodes } from '../episodic-memory/index.js';
import { createSemanticStore, upsertSemanticFact, querySemanticFacts } from '../semantic-memory/index.js';

export class MemoryRuntime {
  constructor({ eventStore, snapshotStore = null, clock = () => new Date().toISOString(), semanticSeed = [] } = {}) {
    if (!eventStore) throw new TypeError('eventStore is required');
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.clock = clock;
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.semanticStore = createSemanticStore(semanticSeed);
    this.seenEventIds = new Set();
  }

  async init() {
    const { records, errors } = await this.eventStore.readAll();
    if (errors.length) throw new Error(`event_log_corrupt:${JSON.stringify(errors)}`);
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
    this.seenEventIds.clear();
    for (const envelope of records) this.#replay(envelope);
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
    await this.#writeSnapshot();

    return {
      duplicate: false,
      event,
      situation,
      memoryDecision,
      salience,
      retrievedEpisodes: memoryDecision.memoryNeeded
        ? retrieveEpisodes(this.episodeStore, { entities: event.entities, limit: memoryDecision.budget || 5, now: event.timestamp })
        : [],
      retrievedFacts: memoryDecision.memoryNeeded
        ? querySemanticFacts(this.semanticStore, { limit: memoryDecision.budget || 5 })
        : [],
      state: this.getState()
    };
  }

  addSemanticFact(input, policy = {}) {
    return upsertSemanticFact(this.semanticStore, input, policy);
  }

  queryMemory(query = {}) {
    return {
      episodes: retrieveEpisodes(this.episodeStore, query.episodes ?? query),
      facts: querySemanticFacts(this.semanticStore, query.facts ?? query)
    };
  }

  getState() {
    return {
      schemaVersion: '1.1.0',
      workingMemory: structuredClone(this.workingMemory),
      episodes: structuredClone(this.episodeStore.episodes),
      semanticFacts: structuredClone(this.semanticStore.facts),
      episodeCount: this.episodeStore.episodes.length,
      semanticFactCount: this.semanticStore.facts.length,
      eventCount: this.seenEventIds.size
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

  async #writeSnapshot() {
    if (!this.snapshotStore) return;
    await this.snapshotStore.append({
      id: `runtime_state_${this.workingMemory.version}`,
      schemaVersion: '1.1.0',
      timestamp: this.clock(),
      state: this.getState()
    });
  }
}

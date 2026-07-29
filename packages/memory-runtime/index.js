import { createWorkingMemory, updateWorkingMemory } from '../working-memory/index.js';
import { interpretMessage } from '../perception/index.js';
import { buildSituationModel } from '../situation-model/index.js';
import { routeMemory } from '../memory-router/index.js';
import { assessSalience } from '../salience/index.js';
import { createEpisodeStore, writeEpisode, retrieveEpisodes } from '../episodic-memory/index.js';

export class MemoryRuntime {
  constructor({ eventStore, snapshotStore = null, clock = () => new Date().toISOString() } = {}) {
    if (!eventStore) throw new TypeError('eventStore is required');
    this.eventStore = eventStore;
    this.snapshotStore = snapshotStore;
    this.clock = clock;
    this.workingMemory = createWorkingMemory();
    this.episodeStore = createEpisodeStore();
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
    const memoryDecision = routeMemory(event, nextWorkingMemory, situation);
    const salience = assessSalience(event, { workingMemory: nextWorkingMemory, situation });

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

    const retrievedEpisodes = memoryDecision.memoryNeeded
      ? retrieveEpisodes(this.episodeStore, { entities: event.entities, limit: memoryDecision.budget || 5 })
      : [];

    return {
      duplicate: false,
      event,
      situation,
      memoryDecision,
      salience,
      retrievedEpisodes,
      state: this.getState()
    };
  }

  getState() {
    return {
      schemaVersion: '1.0.0',
      workingMemory: structuredClone(this.workingMemory),
      episodeCount: this.episodeStore.episodes.length,
      eventCount: this.seenEventIds.size
    };
  }

  #replay(envelope) {
    if (!envelope?.event?.id || this.seenEventIds.has(envelope.event.id)) return;
    this.workingMemory = envelope.workingMemoryAfter ?? updateWorkingMemory(this.workingMemory, envelope.event);
    const score = envelope.salience ?? assessSalience(envelope.event, { workingMemory: this.workingMemory, situation: envelope.situation });
    if (score.shouldWrite) writeEpisode(this.episodeStore, envelope.event, score, { situation: envelope.situation });
    this.seenEventIds.add(envelope.event.id);
  }

  async #writeSnapshot() {
    if (!this.snapshotStore) return;
    await this.snapshotStore.append({
      id: 'runtime_state',
      schemaVersion: '1.0.0',
      timestamp: this.clock(),
      state: this.getState()
    });
  }
}

import { join } from 'node:path';
import { JsonlStore } from '../persistence/jsonl-store.js';
import { MemoryStore } from '../persistence/memory-store.js';
import { MemoryRuntime } from '../memory-runtime/index.js';
import { ResponseRuntime } from '../response-runtime/index.js';
import { createIdentityCore } from '../identity-core/index.js';
import { createRelationshipRegistry } from '../relationship-model/index.js';
import { createProcedureStore } from '../procedural-memory/index.js';
import { createRuntimeApi } from '../runtime-api/index.js';
import { DeterministicLanguageProvider } from '../language-provider/index.js';
import { SpeechSimulationRuntime } from '../speech-simulation-runtime/index.js';

export class CognitiveSystem {
  constructor({ memoryRuntime, responseRuntime, api, stores, identityCore, relationshipRegistry, procedureStore }) {
    this.memoryRuntime = memoryRuntime;
    this.responseRuntime = responseRuntime;
    this.api = api;
    this.stores = stores;
    this.identityCore = identityCore;
    this.relationshipRegistry = relationshipRegistry;
    this.procedureStore = procedureStore;
  }

  async init() { await this.responseRuntime.init(); return this; }
  respond(input, options = {}) { return this.responseRuntime.respond(input, options); }
  process(input) { return this.memoryRuntime.process(input); }
  addSemanticFact(fact, policy = {}) { return this.memoryRuntime.addSemanticFact(fact, policy); }
  addTemporalState(record) { return this.memoryRuntime.addTemporalState(record); }
  resolveTemporalState(subject, stateType, at) { return this.memoryRuntime.resolveTemporalState(subject, stateType, at); }
  queryMemory(query = {}) { return this.memoryRuntime.queryMemory(query); }

  getState() {
    return {
      ...this.memoryRuntime.getState(),
      identityClaimCount: this.identityCore.claims.length,
      relationshipCount: this.relationshipRegistry.relationships.length,
      procedureCount: this.procedureStore.procedures.length
    };
  }
}

export function createLocalCognitiveSystem(options = {}) {
  const dataDir = options.dataDir ?? '.djbrain-local/runtime';
  return createCognitiveSystem({
    ...options,
    stores: {
      events: options.eventStore ?? new JsonlStore(join(dataDir, 'events.jsonl')),
      semantic: options.semanticLogStore ?? new JsonlStore(join(dataDir, 'semantic-mutations.jsonl')),
      temporal: options.temporalLogStore ?? new JsonlStore(join(dataDir, 'temporal-mutations.jsonl')),
      snapshots: options.snapshotStore ?? new JsonlStore(join(dataDir, 'snapshots.jsonl')),
      traces: options.traceStore ?? new JsonlStore(join(dataDir, 'traces.jsonl'))
    }
  });
}

export function createInMemoryCognitiveSystem(options = {}) {
  return createCognitiveSystem({
    ...options,
    stores: {
      events: options.eventStore ?? new MemoryStore(options.eventSeed ?? []),
      semantic: options.semanticLogStore ?? new MemoryStore(options.semanticMutationSeed ?? []),
      temporal: options.temporalLogStore ?? new MemoryStore(options.temporalMutationSeed ?? []),
      snapshots: options.snapshotStore ?? new MemoryStore(options.snapshotSeed ?? []),
      traces: options.traceStore ?? new MemoryStore(options.traceSeed ?? [])
    }
  });
}

// Speech Twin is the primary public constructor. The older response runtime stays available
// for compatibility with action-oriented experiments.
export function createInMemorySpeechTwinSystem(options = {}) { return createSpeechTwinSystem({ ...options, persistent: false }); }
export function createLocalSpeechTwinSystem(options = {}) { return createSpeechTwinSystem({ ...options, persistent: true }); }
function createSpeechTwinSystem(options) {
  const system = options.persistent ? createLocalCognitiveSystem(options) : createInMemoryCognitiveSystem(options);
  system.speechSimulationRuntime = new SpeechSimulationRuntime({ memoryRuntime: system.memoryRuntime, traceSink: system.stores.traces, clock: options.clock, provider: options.speechProvider });
  system.simulateSpeech = (input, runOptions = {}) => system.speechSimulationRuntime.simulate(input, runOptions);
  system.api = createRuntimeApi(system.memoryRuntime, { responseRuntime: system.responseRuntime, speechSimulationRuntime: system.speechSimulationRuntime, traceStore: system.stores.traces });
  return system;
}

function createCognitiveSystem(options) {
  const stores = options.stores;
  const identityCore = options.identityCore ?? createIdentityCore(options.identitySeed ?? []);
  const relationshipRegistry = options.relationshipRegistry ?? createRelationshipRegistry(options.relationshipSeed ?? []);
  const procedureStore = options.procedureStore ?? createProcedureStore(options.procedureSeed ?? []);
  const memoryRuntime = options.memoryRuntime ?? new MemoryRuntime({
    eventStore: stores.events,
    semanticLogStore: stores.semantic,
    temporalLogStore: stores.temporal,
    snapshotStore: stores.snapshots,
    semanticSeed: options.semanticSeed ?? [],
    temporalSeed: options.temporalSeed ?? [],
    vectorScorer: options.vectorScorer ?? null,
    clock: options.clock
  });
  const responseRuntime = options.responseRuntime ?? new ResponseRuntime({
    memoryRuntime,
    languageProvider: options.languageProvider ?? new DeterministicLanguageProvider(),
    privacyContext: options.privacyContext,
    identityCore,
    relationshipRegistry,
    procedureStore,
    traceSink: stores.traces,
    maxRepairAttempts: options.maxRepairAttempts ?? 1
  });
  const system = new CognitiveSystem({ memoryRuntime, responseRuntime, stores, identityCore, relationshipRegistry, procedureStore });
  system.api = createRuntimeApi(memoryRuntime, { responseRuntime, traceStore: stores.traces });
  return system;
}

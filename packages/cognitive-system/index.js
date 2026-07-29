import { join } from 'node:path';
import { JsonlStore } from '../persistence/jsonl-store.js';
import { MemoryRuntime } from '../memory-runtime/index.js';
import { ResponseRuntime } from '../response-runtime/index.js';
import { createIdentityCore } from '../identity-core/index.js';
import { createRelationshipRegistry } from '../relationship-model/index.js';
import { createProcedureStore } from '../procedural-memory/index.js';
import { createRuntimeApi } from '../runtime-api/index.js';
import { DeterministicLanguageProvider } from '../language-provider/index.js';

export class CognitiveSystem {
  constructor({
    memoryRuntime,
    responseRuntime,
    api,
    stores,
    identityCore,
    relationshipRegistry,
    procedureStore
  }) {
    this.memoryRuntime = memoryRuntime;
    this.responseRuntime = responseRuntime;
    this.api = api;
    this.stores = stores;
    this.identityCore = identityCore;
    this.relationshipRegistry = relationshipRegistry;
    this.procedureStore = procedureStore;
  }

  async init() {
    await this.responseRuntime.init();
    return this;
  }

  respond(input, options = {}) {
    return this.responseRuntime.respond(input, options);
  }

  process(input) {
    return this.memoryRuntime.process(input);
  }

  addSemanticFact(fact, policy = {}) {
    return this.memoryRuntime.addSemanticFact(fact, policy);
  }

  queryMemory(query = {}) {
    return this.memoryRuntime.queryMemory(query);
  }

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
  const stores = {
    events: options.eventStore ?? new JsonlStore(join(dataDir, 'events.jsonl')),
    semantic: options.semanticLogStore ?? new JsonlStore(join(dataDir, 'semantic-mutations.jsonl')),
    snapshots: options.snapshotStore ?? new JsonlStore(join(dataDir, 'snapshots.jsonl')),
    traces: options.traceStore ?? new JsonlStore(join(dataDir, 'traces.jsonl'))
  };
  const identityCore = options.identityCore ?? createIdentityCore(options.identitySeed ?? []);
  const relationshipRegistry = options.relationshipRegistry ?? createRelationshipRegistry(options.relationshipSeed ?? []);
  const procedureStore = options.procedureStore ?? createProcedureStore(options.procedureSeed ?? []);
  const memoryRuntime = options.memoryRuntime ?? new MemoryRuntime({
    eventStore: stores.events,
    semanticLogStore: stores.semantic,
    snapshotStore: stores.snapshots,
    semanticSeed: options.semanticSeed ?? [],
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
  const system = new CognitiveSystem({
    memoryRuntime,
    responseRuntime,
    stores,
    identityCore,
    relationshipRegistry,
    procedureStore
  });
  system.api = createRuntimeApi(memoryRuntime, { responseRuntime, traceStore: stores.traces });
  return system;
}

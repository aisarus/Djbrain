import { createIdentityClaim, createIdentityCore } from '../identity-core/index.js';
import { createRelationshipRegistry, upsertRelationship } from '../relationship-model/index.js';
import { createProcedure, createProcedureStore } from '../procedural-memory/index.js';

export class RegistryRuntime {
  constructor({ mutationStore = null, identitySeed = [], relationshipSeed = [], procedureSeed = [], clock = () => new Date().toISOString() } = {}) {
    this.mutationStore = mutationStore;
    this.clock = clock;
    this.identitySeed = structuredClone(identitySeed);
    this.relationshipSeed = structuredClone(relationshipSeed);
    this.procedureSeed = structuredClone(procedureSeed);
    this.identityCore = createIdentityCore(this.identitySeed);
    this.relationshipRegistry = createRelationshipRegistry(this.relationshipSeed);
    this.procedureStore = createProcedureStore(this.procedureSeed);
    this.seenMutationIds = new Set();
  }

  async init() {
    this.identityCore = createIdentityCore(this.identitySeed);
    this.relationshipRegistry = createRelationshipRegistry(this.relationshipSeed);
    this.procedureStore = createProcedureStore(this.procedureSeed);
    this.seenMutationIds.clear();
    if (!this.mutationStore) return this;
    const { records, errors } = await this.mutationStore.readAll();
    if (errors.length) throw new Error(`registry_log_corrupt:${JSON.stringify(errors)}`);
    for (const mutation of records) this.#replay(mutation);
    return this;
  }

  async addIdentityClaim(input) {
    const claim = createIdentityClaim(input);
    const existing = this.identityCore.claims.find((item) => normalize(item.claim) === normalize(claim.claim));
    const mutation = this.#mutation('identity_upsert', { claim });
    const result = applyIdentity(this.identityCore, claim);
    mutation.result = { action: existing ? 'merged' : 'inserted', id: result.id };
    await this.#persist(mutation);
    return mutation.result;
  }

  async addRelationship(input, policy = {}) {
    const mutation = this.#mutation('relationship_upsert', { relationship: input, policy: { allowOverwrite: policy.allowOverwrite === true } });
    const result = upsertRelationship(this.relationshipRegistry, input, policy);
    mutation.result = { action: result.action, personId: result.relationship.personId };
    await this.#persist(mutation);
    return result;
  }

  async addProcedure(input) {
    const procedure = createProcedure(input);
    const mutation = this.#mutation('procedure_upsert', { procedure });
    const result = applyProcedure(this.procedureStore, procedure);
    mutation.result = { action: result.action, id: result.procedure.id };
    await this.#persist(mutation);
    return result;
  }

  getState() {
    return {
      schemaVersion: '1.0.0',
      identityClaims: structuredClone(this.identityCore.claims),
      relationships: structuredClone(this.relationshipRegistry.relationships),
      procedures: structuredClone(this.procedureStore.procedures),
      mutationCount: this.seenMutationIds.size
    };
  }

  #mutation(type, payload) {
    return {
      id: `registry_mutation_${crypto.randomUUID()}`,
      schemaVersion: '1.0.0',
      type,
      timestamp: this.clock(),
      ...structuredClone(payload)
    };
  }

  async #persist(mutation) {
    if (this.mutationStore) await this.mutationStore.append(mutation);
    this.seenMutationIds.add(mutation.id);
  }

  #replay(mutation) {
    if (!mutation?.id || this.seenMutationIds.has(mutation.id)) return;
    if (mutation.type === 'identity_upsert') applyIdentity(this.identityCore, mutation.claim);
    else if (mutation.type === 'relationship_upsert') upsertRelationship(this.relationshipRegistry, mutation.relationship, mutation.policy ?? {});
    else if (mutation.type === 'procedure_upsert') applyProcedure(this.procedureStore, mutation.procedure);
    else throw new Error(`invalid_registry_mutation:${mutation.id}`);
    this.seenMutationIds.add(mutation.id);
  }
}

function applyIdentity(core, input) {
  const incoming = createIdentityClaim(input);
  const index = core.claims.findIndex((item) => normalize(item.claim) === normalize(incoming.claim));
  if (index === -1) {
    core.claims.push(incoming);
    return incoming;
  }
  const current = core.claims[index];
  const merged = createIdentityClaim({
    ...current,
    ...incoming,
    id: current.id,
    supportingPatternIds: unique([...current.supportingPatternIds, ...incoming.supportingPatternIds]),
    counterEvidenceIds: unique([...current.counterEvidenceIds, ...incoming.counterEvidenceIds]),
    applicableContexts: unique([...current.applicableContexts, ...incoming.applicableContexts]),
    exceptions: unique([...current.exceptions, ...incoming.exceptions]),
    confidence: Math.max(current.confidence, incoming.confidence),
    stability: Math.max(current.stability, incoming.stability),
    reviewStatus: current.reviewStatus === 'verified' || incoming.reviewStatus === 'verified' ? 'verified' : incoming.reviewStatus
  });
  core.claims[index] = merged;
  return merged;
}

function applyProcedure(store, input) {
  const incoming = createProcedure(input);
  const index = store.procedures.findIndex((item) => item.id === incoming.id);
  if (index === -1) {
    store.procedures.push(incoming);
    return { action: 'inserted', procedure: incoming };
  }
  const current = store.procedures[index];
  const merged = createProcedure({
    ...current,
    ...incoming,
    evidenceEpisodeIds: unique([...current.evidenceEpisodeIds, ...incoming.evidenceEpisodeIds]),
    successCount: Math.max(current.successCount, incoming.successCount),
    failureCount: Math.max(current.failureCount, incoming.failureCount),
    confidence: Math.max(current.confidence, incoming.confidence),
    status: current.status === 'verified' || incoming.status === 'verified' ? 'verified' : incoming.status
  });
  store.procedures[index] = merged;
  return { action: 'merged', procedure: merged };
}

function normalize(value) { return String(value).toLowerCase().replace(/\s+/g, ' ').trim(); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

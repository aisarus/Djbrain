import { createPrivacyContext, enforceContextPrivacy } from '../privacy/index.js';
import { selectResponseStrategy } from '../strategy-selector/index.js';
import { assembleGenerationContext } from '../context-assembler/index.js';
import { DeterministicLanguageProvider, validateGenerationResult } from '../language-provider/index.js';
import { critiqueResponse } from '../critic/index.js';
import { selectIdentityClaims } from '../identity-core/index.js';
import { selectRelationshipContext } from '../relationship-model/index.js';
import { retrieveProcedures } from '../procedural-memory/index.js';
import { createTrace, recordStage, finishTrace } from '../observability/index.js';

export class ResponseRuntime {
  constructor({
    memoryRuntime,
    languageProvider = new DeterministicLanguageProvider(),
    privacyContext = null,
    identityCore = null,
    relationshipRegistry = null,
    procedureStore = null,
    traceSink = null,
    maxRepairAttempts = 1
  } = {}) {
    if (!memoryRuntime) throw new TypeError('memoryRuntime is required');
    this.memoryRuntime = memoryRuntime;
    this.languageProvider = languageProvider;
    this.privacyContext = privacyContext ?? createPrivacyContext();
    this.identityCore = identityCore;
    this.relationshipRegistry = relationshipRegistry;
    this.procedureStore = procedureStore;
    this.traceSink = traceSink;
    this.maxRepairAttempts = maxRepairAttempts;
  }

  async init() {
    await this.memoryRuntime.init();
    return this;
  }

  async respond(input, options = {}) {
    const runId = options.runId ?? `response_${crypto.randomUUID()}`;
    const trace = createTrace(runId, options.timestamp ?? new Date().toISOString());
    try {
      const cognitiveStarted = Date.now();
      const cognitive = await this.memoryRuntime.process(input);
      recordStage(trace, 'cognitive_runtime', {
        inputRefs: [typeof input === 'object' ? input.id : null].filter(Boolean),
        outputRefs: [cognitive.event?.id].filter(Boolean),
        decision: cognitive.memoryDecision?.reason,
        confidence: cognitive.event?.confidence
      }, { durationMs: Date.now() - cognitiveStarted });

      if (cognitive.duplicate) {
        finishTrace(trace, { status: 'succeeded', metrics: { duplicate: true } });
        await this.#persistTrace(trace);
        return { duplicate: true, cognitive, response: null, trace };
      }

      const enrichmentStarted = Date.now();
      const enrichment = this.#selectSpecializedContext(cognitive, options);
      recordStage(trace, 'specialized_memory_selection', {
        outputRefs: [
          ...enrichment.identityClaims.map((item) => item.claim?.id ?? item.id),
          ...enrichment.relationships.map((item) => item.personId),
          ...enrichment.procedures.map((item) => item.procedure?.id ?? item.id)
        ].filter(Boolean),
        reason: 'select_context_specific_identity_relationship_and_procedural_memory'
      }, { durationMs: Date.now() - enrichmentStarted });

      const memoryBundle = normalizeMemoryBundle(cognitive, enrichment);
      const privacyContext = createPrivacyContext({
        ...this.privacyContext,
        ...(options.privacyContext ?? {}),
        allowedPersonIds: options.personIds ?? options.privacyContext?.allowedPersonIds ?? this.privacyContext.allowedPersonIds
      });
      const privacyStarted = Date.now();
      const privacyReport = enforceContextPrivacy(memoryBundle, privacyContext);
      recordStage(trace, 'privacy', {
        outputRefs: privacyReport.allowed.map((item) => item.id ?? item.personId).filter(Boolean),
        decision: `${privacyReport.allowed.length}_allowed_${privacyReport.blocked.length}_blocked`,
        warnings: privacyReport.blocked.length ? ['memory_items_blocked_by_privacy'] : []
      }, { durationMs: Date.now() - privacyStarted });

      const strategy = selectResponseStrategy({
        event: cognitive.event,
        situation: cognitive.situation,
        memoryDecision: cognitive.memoryDecision,
        memories: privacyReport.allowed,
        privacyReport
      });
      recordStage(trace, 'strategy', {
        decision: strategy.move,
        confidence: strategy.confidence,
        reason: strategy.reason
      });

      const context = assembleGenerationContext({
        event: cognitive.event,
        situation: cognitive.situation,
        workingMemory: cognitive.state.workingMemory,
        strategy,
        memories: privacyReport.allowed,
        maxItems: options.maxMemoryItems ?? cognitive.memoryDecision.budget ?? 5,
        maxChars: options.maxContextChars ?? 6000
      });
      recordStage(trace, 'context_assembly', {
        outputRefs: context.memories.map((memory) => memory.id).filter(Boolean),
        decision: `${context.budget.usedItems}_items_${context.budget.usedChars}_chars`
      });

      const generationStarted = Date.now();
      let generation = await this.languageProvider.generate(context);
      let validation = validateGenerationResult(generation);
      if (!validation.valid) throw new Error(`invalid_generation:${validation.errors.join(',')}`);
      recordStage(trace, 'generation', {
        decision: generation.model ?? generation.provider,
        warnings: generation.usage?.truncated ? ['provider_output_truncated'] : []
      }, { durationMs: Date.now() - generationStarted });

      let critic = critiqueResponse({ event: cognitive.event, strategy, context, generation });
      let attempts = 0;
      while (critic.repairRequired && attempts < this.maxRepairAttempts && typeof this.languageProvider.repair === 'function') {
        generation = await this.languageProvider.repair({ context, generation, critic });
        validation = validateGenerationResult(generation);
        if (!validation.valid) throw new Error(`invalid_repaired_generation:${validation.errors.join(',')}`);
        critic = critiqueResponse({ event: cognitive.event, strategy, context, generation });
        attempts += 1;
      }
      recordStage(trace, 'critic', {
        decision: critic.status,
        reason: critic.reasons?.join(',') ?? null,
        warnings: critic.warnings ?? []
      });

      const delivered = critic.status !== 'rejected';
      finishTrace(trace, {
        status: delivered ? 'succeeded' : 'rejected',
        metrics: {
          allowedMemoryCount: privacyReport.allowed.length,
          blockedMemoryCount: privacyReport.blocked.length,
          repairAttempts: attempts,
          delivered
        }
      });
      await this.#persistTrace(trace);

      return {
        duplicate: false,
        cognitive,
        enrichment,
        privacyReport,
        strategy,
        context,
        generation,
        critic,
        delivered,
        response: delivered ? generation.text : null,
        trace
      };
    } catch (error) {
      finishTrace(trace, { status: 'failed', errors: [{ name: error.name, message: error.message }] });
      await this.#persistTrace(trace);
      throw error;
    }
  }

  #selectSpecializedContext(cognitive, options) {
    const contextTags = unique([
      cognitive.situation.currentGoal,
      cognitive.situation.currentStage,
      cognitive.memoryDecision.category,
      ...(options.contextTags ?? [])
    ]);
    const identityClaims = this.identityCore
      ? selectIdentityClaims(this.identityCore, {
          contexts: contextTags,
          currentGoal: cognitive.situation.currentGoal,
          situationType: cognitive.memoryDecision.category,
          relationshipMode: options.relationshipMode
        }, { limit: options.identityLimit ?? 4, allowCandidates: options.allowCandidateIdentity === true })
      : [];
    const personIds = unique(options.personIds ?? []);
    const relationships = this.relationshipRegistry
      ? selectRelationshipContext(this.relationshipRegistry, personIds, {
          limit: options.relationshipLimit ?? 3,
          includeSensitive: options.includeSensitiveRelationships === true
        })
      : [];
    const procedures = this.procedureStore
      ? retrieveProcedures(this.procedureStore, {
          trigger: cognitive.event.text,
          contextTags,
          limit: options.procedureLimit ?? 3
        })
      : [];
    return { identityClaims, relationships, procedures };
  }

  async #persistTrace(trace) {
    if (!this.traceSink) return;
    if (typeof this.traceSink.append === 'function') await this.traceSink.append(trace);
    else if (typeof this.traceSink === 'function') await this.traceSink(trace);
  }
}

function normalizeMemoryBundle(cognitive, enrichment = {}) {
  return {
    episodes: cognitive.retrievedEpisodes ?? [],
    facts: cognitive.retrievedFacts ?? cognitive.semanticFacts ?? [],
    temporalStates: cognitive.temporalStates ?? [],
    identityClaims: enrichment.identityClaims ?? cognitive.identityClaims ?? [],
    relationships: enrichment.relationships ?? [],
    procedures: enrichment.procedures ?? []
  };
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

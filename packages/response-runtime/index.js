import { createPrivacyContext, enforceContextPrivacy } from '../privacy/index.js';
import { selectResponseStrategy } from '../strategy-selector/index.js';
import { assembleGenerationContext } from '../context-assembler/index.js';
import { DeterministicLanguageProvider, validateGenerationResult } from '../language-provider/index.js';
import { critiqueResponse } from '../critic/index.js';

export class ResponseRuntime {
  constructor({ memoryRuntime, languageProvider = new DeterministicLanguageProvider(), privacyContext = null, maxRepairAttempts = 1 } = {}) {
    if (!memoryRuntime) throw new TypeError('memoryRuntime is required');
    this.memoryRuntime = memoryRuntime;
    this.languageProvider = languageProvider;
    this.privacyContext = privacyContext ?? createPrivacyContext();
    this.maxRepairAttempts = maxRepairAttempts;
  }

  async init() {
    await this.memoryRuntime.init();
    return this;
  }

  async respond(input, options = {}) {
    const cognitive = await this.memoryRuntime.process(input);
    if (cognitive.duplicate) return { duplicate: true, cognitive, response: null };

    const memoryBundle = normalizeMemoryBundle(cognitive);
    const privacyContext = createPrivacyContext({ ...this.privacyContext, ...(options.privacyContext ?? {}) });
    const privacyReport = enforceContextPrivacy(memoryBundle, privacyContext);
    const strategy = selectResponseStrategy({
      event: cognitive.event,
      situation: cognitive.situation,
      memoryDecision: cognitive.memoryDecision,
      memories: privacyReport.allowed,
      privacyReport
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

    let generation = await this.languageProvider.generate(context);
    let validation = validateGenerationResult(generation);
    if (!validation.valid) throw new Error(`invalid_generation:${validation.errors.join(',')}`);
    let critic = critiqueResponse({ event: cognitive.event, strategy, context, generation });
    let attempts = 0;

    while (critic.repairRequired && attempts < this.maxRepairAttempts && typeof this.languageProvider.repair === 'function') {
      generation = await this.languageProvider.repair({ context, generation, critic });
      validation = validateGenerationResult(generation);
      if (!validation.valid) throw new Error(`invalid_repaired_generation:${validation.errors.join(',')}`);
      critic = critiqueResponse({ event: cognitive.event, strategy, context, generation });
      attempts += 1;
    }

    return {
      duplicate: false,
      cognitive,
      privacyReport,
      strategy,
      context,
      generation,
      critic,
      delivered: critic.status !== 'rejected',
      response: critic.status === 'rejected' ? null : generation.text
    };
  }
}

function normalizeMemoryBundle(cognitive) {
  return {
    episodes: cognitive.retrievedEpisodes ?? [],
    facts: cognitive.retrievedFacts ?? cognitive.semanticFacts ?? [],
    temporalStates: cognitive.temporalStates ?? [],
    identityClaims: cognitive.identityClaims ?? []
  };
}

import { runBenchmark } from '../benchmark-harness/index.js';
import { createInMemoryCognitiveSystem } from '../cognitive-system/index.js';
import { arseniyBenchmarkV1, benchmarkMetadata } from '../../benchmarks/arseniy-v1.js';

const DEFAULT_IDENTITY = [{
  id: 'identity_direct_execution',
  claim: 'Prefer concrete execution over progress theatre.',
  applicableContexts: ['build_functional_digital_brain','project'],
  supportingPatternIds: ['pattern_direct_1','pattern_direct_2','pattern_direct_3'],
  confidence: 0.92,
  stability: 0.9,
  reviewStatus: 'verified',
  sensitivity: 'private'
}];

const DEFAULT_RELATIONSHIPS = [{
  personId: 'codex',
  displayName: 'Codex',
  role: 'colleague',
  trust: 'medium',
  closeness: 0.35,
  communicationPreferences: ['english_machine_readable_tasks'],
  evidenceEpisodeIds: ['synthetic_codex_episode'],
  confidence: 0.8,
  sensitivity: 'private'
}];

const DEFAULT_PROCEDURES = [{
  id: 'procedure_continue_backend',
  trigger: 'продолжай строить backend',
  contextTags: ['build_functional_digital_brain','project'],
  steps: [
    { action: 'inspect current implementation and failing contracts' },
    { action: 'implement the next complete vertical slice' },
    { action: 'run regression benchmark and repair failures' }
  ],
  successCount: 4,
  failureCount: 0,
  evidenceEpisodeIds: ['synthetic_proc_1','synthetic_proc_2','synthetic_proc_3','synthetic_proc_4'],
  confidence: 0.83,
  status: 'verified',
  sensitivity: 'private'
}];

export async function runArseniyBenchmarkV1(options = {}) {
  const cases = options.cases ?? arseniyBenchmarkV1;
  const report = await runBenchmark(cases, async (input, testCase) => {
    const system = createInMemoryCognitiveSystem({
      clock: () => input.timestamp,
      identitySeed: options.identitySeed ?? DEFAULT_IDENTITY,
      relationshipSeed: options.relationshipSeed ?? DEFAULT_RELATIONSHIPS,
      procedureSeed: options.procedureSeed ?? DEFAULT_PROCEDURES,
      semanticSeed: options.semanticSeed ?? []
    });
    await system.init();
    return system.respond(input, testCase.options ?? {});
  }, { includeOutputs: options.includeOutputs ?? false });

  return {
    benchmark: benchmarkMetadata,
    runtime: 'deterministic-cognitive-system',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    ...report
  };
}

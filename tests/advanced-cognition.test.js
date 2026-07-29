import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrace, recordStage, finishTrace, summarizeTrace } from '../packages/observability/index.js';
import { createRelationshipRegistry, upsertRelationship, selectRelationshipContext } from '../packages/relationship-model/index.js';
import { createProcedureStore, createProcedure, recordProcedureOutcome, retrieveProcedures } from '../packages/procedural-memory/index.js';
import { createConsolidationScheduler, planConsolidation, markConsolidationRun } from '../packages/consolidation-scheduler/index.js';
import { createOpenAICompatibleProvider } from '../packages/provider-adapters/openai-compatible.js';

test('records inspectable cognitive traces', () => {
  const trace = createTrace('run_1', '2026-07-29T09:00:00Z');
  recordStage(trace, 'retrieval', { decision: 'episodic_memory', confidence: 0.8 }, { durationMs: 12 });
  finishTrace(trace, { metrics: { retrieved: 3 } });
  assert.deepEqual(summarizeTrace(trace), {
    id: 'run_1',
    runId: 'run_1',
    status: 'succeeded',
    stageCount: 1,
    totalDurationMs: 12,
    warnings: [],
    errors: [],
    metrics: { retrieved: 3 }
  });
});

test('relationship updates preserve boundaries and evidence', () => {
  const registry = createRelationshipRegistry();
  upsertRelationship(registry, { personId: 'p1', role: 'partner', closeness: 0.8, boundaries: ['private'], evidenceEpisodeIds: ['e1'], confidence: 0.7 });
  upsertRelationship(registry, { personId: 'p1', role: 'partner', closeness: 0.9, communicationPreferences: ['direct'], evidenceEpisodeIds: ['e2'], confidence: 0.8 });
  const [context] = selectRelationshipContext(registry, ['p1']);
  assert.deepEqual(context.boundaries, ['private']);
  assert.deepEqual(context.evidenceEpisodeIds.sort(), ['e1','e2']);
  assert.equal(context.communicationPreferences[0], 'direct');
});

test('procedures become verified only after repeated successful outcomes', () => {
  const store = createProcedureStore([createProcedure({ id: 'proc_1', trigger: 'correct user feedback', contextTags: ['feedback'], steps: ['acknowledge','repair'] })]);
  for (let index = 0; index < 5; index += 1) recordProcedureOutcome(store, 'proc_1', { success: true, episodeId: `e${index}` });
  const [{ procedure }] = retrieveProcedures(store, { trigger: 'please correct the user feedback now', contextTags: ['feedback'] });
  assert.equal(procedure.status, 'verified');
  assert.ok(procedure.confidence >= 0.7);
});

test('consolidation scheduler waits for eligible episodes and interval', () => {
  const scheduler = createConsolidationScheduler({ minEpisodeAgeMs: 1000, replayIntervalMs: 1000 });
  const episodes = [{ id: 'e1', timeEnd: '2026-07-29T08:00:00Z', status: 'candidate', importance: 0.8, novelty: 0.7, correctionStrength: 0 }];
  const plan = planConsolidation(scheduler, episodes, '2026-07-29T09:00:00Z');
  assert.equal(plan.shouldRun, true);
  markConsolidationRun(scheduler, '2026-07-29T09:00:00Z');
  assert.equal(planConsolidation(scheduler, episodes, '2026-07-29T09:00:00.500Z').shouldRun, false);
});

test('OpenAI-compatible adapter maps cognitive request and response', async () => {
  let captured;
  const provider = createOpenAICompatibleProvider({
    baseUrl: 'http://local.test/v1',
    model: 'test-model',
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return { ok: true, async json() { return { id: 'r1', model: 'test-model', choices: [{ message: { content: 'done' }, finish_reason: 'stop' }], usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 } }; } };
    }
  });
  const result = await provider.generate({ system: 'system', prompt: 'hello' });
  assert.equal(result.provider, 'openai-compatible');
  assert.equal(result.text, 'done');
  assert.equal(result.usage.totalTokens, 4);
  assert.match(captured.url, /chat\/completions$/);
  assert.equal(JSON.parse(captured.init.body).messages.length, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivacyContext, filterMemoriesByPrivacy } from '../packages/privacy/index.js';
import { selectResponseStrategy } from '../packages/strategy-selector/index.js';
import { assembleGenerationContext, validateGenerationContext } from '../packages/context-assembler/index.js';
import { critiqueResponse } from '../packages/critic/index.js';
import { ResponseRuntime } from '../packages/response-runtime/index.js';

const event = {
  id: 'evt_response_1',
  text: 'Продолжай строить backend мозга.',
  intent: 'request_action',
  speechAct: 'request',
  tone: 'intense_direct',
  entities: ['Djbrain','backend'],
  confidence: 0.9
};
const situation = {
  userGoal: 'obtain_concrete_action',
  currentGoal: 'build_functional_digital_brain',
  currentStage: 'reconstruct_cognitive_functions_incrementally',
  expectedResponse: 'perform_requested_action',
  mainRisk: 'produce_architecture_without_executable_behavior',
  uncertainty: 0.1
};
const memoryDecision = { memoryNeeded: true, budget: 3 };
const workingMemory = {
  currentGoal: 'build_functional_digital_brain',
  currentSubgoal: 'implement_response_loop',
  activeEntities: ['Djbrain','backend'],
  constraints: ['avoid:plan_only'],
  recentDecisions: ['build backend first']
};

test('privacy blocks sensitive and raw memories outside scope', () => {
  const report = filterMemoriesByPrivacy([
    { id: 'm1', layer: 'semantic_memory', sensitivity: 'private', predicate: 'project_phase', value: 'backend' },
    { id: 'm2', layer: 'semantic_memory', sensitivity: 'sensitive', predicate: 'health', value: 'private', rawText: 'secret' }
  ], createPrivacyContext({ allowedSensitivity: 'private', allowRawText: false }));
  assert.equal(report.allowed.length, 1);
  assert.equal(report.blocked.length, 1);
  assert.deepEqual(report.blocked[0].reasons, ['sensitivity_exceeds_scope','raw_text_not_allowed']);
});

test('strategy prioritizes action and avoids planning-only answers', () => {
  const strategy = selectResponseStrategy({ event, situation, memoryDecision, memories: [] });
  assert.equal(strategy.move, 'perform_action');
  assert.ok(strategy.avoid.includes('plan_only_response'));
  assert.ok(strategy.objectives.includes('complete_requested_action'));
});

test('context assembler obeys item and character budgets', () => {
  const strategy = selectResponseStrategy({ event, situation, memoryDecision, memories: [] });
  const context = assembleGenerationContext({
    event,
    situation,
    workingMemory,
    strategy,
    memories: Array.from({ length: 10 }, (_, index) => ({ id: `m${index}`, layer: 'semantic_memory', subject: 'project', predicate: 'fact', value: `value-${index}`, confidence: 0.8, entities: ['backend'] })),
    maxItems: 3,
    maxChars: 1000
  });
  assert.equal(context.memories.length, 3);
  assert.equal(validateGenerationContext(context).valid, true);
});

test('critic rejects unsupported memory references', () => {
  const strategy = selectResponseStrategy({ event, situation, memoryDecision: { memoryNeeded: false, budget: 0 }, memories: [] });
  const context = assembleGenerationContext({ event, situation, workingMemory, strategy, memories: [] });
  const report = critiqueResponse({ event, strategy, context, generation: { text: 'As you said previously, this is definitely correct.' } });
  assert.equal(report.status, 'rejected');
  assert.ok(report.blocking.includes('unsupported_memory_reference'));
});

test('response runtime produces an end-to-end response with privacy and critic reports', async () => {
  const fakeMemoryRuntime = {
    async init() {},
    async process() {
      return {
        duplicate: false,
        event,
        situation,
        memoryDecision,
        retrievedEpisodes: [{ episode: { id: 'ep1', sourceEventIds: ['evt_old'], summary: 'Backend direction chosen', entities: ['backend'], importance: 0.9, sensitivity: 'private' }, score: 0.9 }],
        state: { workingMemory }
      };
    }
  };
  const runtime = new ResponseRuntime({ memoryRuntime: fakeMemoryRuntime });
  await runtime.init();
  const result = await runtime.respond(event.text);
  assert.equal(result.delivered, true);
  assert.equal(result.strategy.move, 'perform_action');
  assert.equal(result.context.memories.length, 1);
  assert.equal(result.critic.status, 'approved');
  assert.match(result.response, /Executing the requested action/);
});

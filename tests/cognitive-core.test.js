import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretMessage } from '../packages/perception/index.js';
import { createWorkingMemory, updateWorkingMemory, validateWorkingMemory } from '../packages/working-memory/index.js';
import { validateCognitiveEvent } from '../packages/contracts/cognitive-event.js';
import { buildSituationModel, validateSituationModel } from '../packages/situation-model/index.js';
import { routeMemory, validateMemoryDecision } from '../packages/memory-router/index.js';

test('interprets a project direction decision', () => {
  const event = interpretMessage({
    id: 'evt_test_1',
    timestamp: '2026-07-29T11:52:00+03:00',
    text: 'Давайте выполнять, приступаем к бэкенду мозга функция за функцией.'
  });

  assert.equal(event.speechAct, 'decision');
  assert.equal(event.intent, 'set_project_direction');
  assert.deepEqual(event.entities, ['Djbrain', 'backend']);
  assert.equal(validateCognitiveEvent(event).valid, true);
});

test('updates active goal and subgoal from a decision', () => {
  const state = createWorkingMemory();
  const event = interpretMessage({
    id: 'evt_test_2',
    timestamp: '2026-07-29T11:52:00+03:00',
    text: 'Делаем бэкенд и реконструируем функции мозга постепенно.'
  });
  const next = updateWorkingMemory(state, event);

  assert.equal(next.currentGoal, 'build_functional_digital_brain');
  assert.equal(next.currentSubgoal, 'reconstruct_cognitive_functions_incrementally');
  assert.equal(next.version, 1);
  assert.equal(next.recentEvents.length, 1);
  assert.equal(validateWorkingMemory(next).valid, true);
});

test('turns explicit correction into a working-memory constraint', () => {
  const state = createWorkingMemory();
  const event = interpretMessage({
    id: 'evt_test_3',
    timestamp: '2026-07-29T11:53:00+03:00',
    text: 'Нет, не надо сейчас делать лишний визуал.'
  });
  const next = updateWorkingMemory(state, event);

  assert.equal(event.speechAct, 'correction');
  assert.match(next.constraints[0], /^avoid:/);
  assert.equal(event.metadata.negated, true);
});

test('bounds recent events instead of growing forever', () => {
  let state = createWorkingMemory();
  for (let index = 0; index < 5; index += 1) {
    const event = interpretMessage({
      id: `evt_${index}`,
      timestamp: `2026-07-29T11:5${index}:00+03:00`,
      text: `Сообщение номер ${index}`
    });
    state = updateWorkingMemory(state, event, { eventLimit: 3 });
  }
  assert.equal(state.recentEvents.length, 3);
});

test('detects mixed language and ambiguity cues', () => {
  const event = interpretMessage({
    id: 'evt_mixed',
    timestamp: '2026-07-29T11:54:00+03:00',
    text: 'Ну да конечно, давай build backend прямо сейчас.'
  });

  assert.equal(event.language, 'mixed');
  assert.equal(event.metadata.literalness, 'uncertain');
  assert.ok(event.metadata.ambiguityFlags.includes('possible_irony'));
  assert.ok(event.confidence < 0.82);
});

test('builds a situation model from current event and working memory', () => {
  let state = createWorkingMemory();
  const event = interpretMessage({
    id: 'evt_situation',
    timestamp: '2026-07-29T11:55:00+03:00',
    text: 'Делаем бэкенд мозга функция за функцией.'
  });
  state = updateWorkingMemory(state, event);
  const situation = buildSituationModel(event, state);

  assert.equal(situation.currentGoal, 'build_functional_digital_brain');
  assert.equal(situation.expectedResponse, 'acknowledge_and_execute');
  assert.equal(situation.mainRisk, 'produce_architecture_without_executable_behavior');
  assert.equal(validateSituationModel(situation).valid, true);
});

test('routes project turns to only relevant memory layers', () => {
  let state = createWorkingMemory();
  const event = interpretMessage({
    id: 'evt_route_project',
    timestamp: '2026-07-29T11:56:00+03:00',
    text: 'Продолжай собирать backend Djbrain.'
  });
  state = updateWorkingMemory(state, event);
  const situation = buildSituationModel(event, state);
  const decision = routeMemory(event, situation, state);

  assert.equal(decision.memoryNeeded, true);
  assert.equal(decision.category, 'project');
  assert.deepEqual(decision.selectedLayers, ['working_memory', 'temporal_state', 'recent_decisions']);
  assert.ok(decision.excludedLayers.includes('health'));
  assert.equal(validateMemoryDecision(decision).valid, true);
});

test('does not retrieve long-term memory for a context-free trivial question', () => {
  const state = createWorkingMemory();
  const event = interpretMessage({
    id: 'evt_route_none',
    timestamp: '2026-07-29T11:57:00+03:00',
    text: 'Сколько будет два плюс два?'
  });
  const situation = buildSituationModel(event, state);
  const decision = routeMemory(event, situation, state);

  assert.equal(decision.memoryNeeded, false);
  assert.deepEqual(decision.selectedLayers, []);
  assert.equal(decision.budget, 0);
});

test('routes corrections through feedback and recent events', () => {
  let state = createWorkingMemory({ currentGoal: 'build_functional_digital_brain' });
  const event = interpretMessage({
    id: 'evt_route_correction',
    timestamp: '2026-07-29T11:58:00+03:00',
    text: 'Нет, ты опять ушёл в лишний визуал.'
  });
  state = updateWorkingMemory(state, event);
  const situation = buildSituationModel(event, state);
  const decision = routeMemory(event, situation, state);

  assert.equal(decision.category, 'correction');
  assert.deepEqual(decision.selectedLayers, ['working_memory', 'feedback', 'recent_events']);
});

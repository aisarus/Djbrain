import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretMessage } from '../packages/perception/index.js';
import { createWorkingMemory, updateWorkingMemory, validateWorkingMemory } from '../packages/working-memory/index.js';
import { validateCognitiveEvent } from '../packages/contracts/cognitive-event.js';

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

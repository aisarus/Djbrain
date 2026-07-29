import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretMessage } from '../packages/perception/index.js';
import { buildEpisodes } from '../packages/episode-builder/index.js';

function event(id, timestamp, text) {
  return interpretMessage({ id, timestamp, text });
}

test('groups related nearby turns into one episode', () => {
  const episodes = buildEpisodes([
    event('e1', '2026-07-29T12:00:00Z', 'Решили делать backend Djbrain.'),
    event('e2', '2026-07-29T12:03:00Z', 'Продолжай backend функция за функцией.'),
    event('e3', '2026-07-29T12:05:00Z', 'Нет, не называй каркас готовым модулем.')
  ]);

  assert.equal(episodes.length, 1);
  assert.deepEqual(episodes[0].sourceEventIds, ['e1', 'e2', 'e3']);
  assert.equal(episodes[0].outcome, 'behavior_constraint_added');
  assert.equal(episodes[0].topics.includes('djbrain_backend'), true);
});

test('separates events after a large temporal gap', () => {
  const episodes = buildEpisodes([
    event('e1', '2026-07-29T12:00:00Z', 'Решили делать backend Djbrain.'),
    event('e2', '2026-07-29T14:00:00Z', 'Продолжай backend Djbrain.')
  ]);
  assert.equal(episodes.length, 2);
});

test('ignores an isolated low-value acknowledgement', () => {
  const episodes = buildEpisodes([
    event('e1', '2026-07-29T12:00:00Z', 'Окей.')
  ]);
  assert.equal(episodes.length, 0);
});

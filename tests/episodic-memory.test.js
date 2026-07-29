import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretMessage } from '../packages/perception/index.js';
import { scoreSalience } from '../packages/salience/index.js';
import { createEpisodeStore, writeEventToEpisodeStore, retrieveEpisodes, validateEpisodeStore } from '../packages/episodic-memory/index.js';

function event(id, timestamp, text) {
  return interpretMessage({ id, timestamp, text });
}

test('scores explicit correction as salient and writable', () => {
  const result = scoreSalience(event('evt_salience_1', '2026-07-29T12:00:00+03:00', 'Нет, не делай больше лишний визуал, работаем над backend.'));
  assert.equal(result.shouldWrite, true);
  assert.equal(result.reason, 'explicit_correction');
  assert.ok(result.correctionStrength >= 0.9);
});

test('does not write low-value transient message by default', () => {
  const store = createEpisodeStore();
  const result = writeEventToEpisodeStore(store, event('evt_transient', '2026-07-29T12:01:00+03:00', 'Окей.'));
  assert.equal(result.written, false);
  assert.equal(result.store.episodes.length, 0);
});

test('writes a project decision with provenance', () => {
  const store = createEpisodeStore();
  const result = writeEventToEpisodeStore(store, event('evt_decision', '2026-07-29T12:02:00+03:00', 'Делаем backend Djbrain функция за функцией.'));
  assert.equal(result.written, true);
  assert.equal(result.episode.provenance.eventId, 'evt_decision');
  assert.ok(result.episode.topics.includes('djbrain_backend'));
  assert.equal(validateEpisodeStore(result.store).valid, true);
});

test('links episodes in temporal order', () => {
  let store = createEpisodeStore();
  store = writeEventToEpisodeStore(store, event('evt_second', '2026-07-29T12:04:00+03:00', 'Делаем backend Djbrain дальше.'), {}, { force: true }).store;
  store = writeEventToEpisodeStore(store, event('evt_first', '2026-07-29T12:03:00+03:00', 'Начинаем backend Djbrain.'), {}, { force: true }).store;
  assert.equal(store.episodes[0].sourceEventIds[0], 'evt_first');
  assert.equal(store.episodes[0].nextEpisodeId, store.episodes[1].id);
  assert.equal(store.episodes[1].previousEpisodeId, store.episodes[0].id);
});

test('retrieves the most relevant matching episode', () => {
  let store = createEpisodeStore();
  store = writeEventToEpisodeStore(store, event('evt_data', '2026-07-28T10:00:00+03:00', 'Надо подготовить dataset и pipeline данных.'), {}, { force: true }).store;
  store = writeEventToEpisodeStore(store, event('evt_backend', '2026-07-29T12:05:00+03:00', 'Делаем backend Djbrain функция за функцией.'), {}, { force: true }).store;
  const results = retrieveEpisodes(store, { entities: ['Djbrain','backend'], topics: ['djbrain_backend'], now: '2026-07-29T12:06:00+03:00' });
  assert.equal(results[0].episode.sourceEventIds[0], 'evt_backend');
  assert.ok(results[0].score > results.at(-1).score);
});

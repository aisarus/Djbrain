import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonlStore } from '../packages/persistence/jsonl-store.js';
import { MemoryRuntime } from '../packages/memory-runtime/index.js';

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'djbrain-'));
  const events = new JsonlStore(join(dir, 'events.jsonl'));
  const snapshots = new JsonlStore(join(dir, 'snapshots.jsonl'));
  const runtime = new MemoryRuntime({ eventStore: events, snapshotStore: snapshots });
  await runtime.init();
  return { dir, events, snapshots, runtime };
}

test('persists a meaningful turn and restores it after restart', async () => {
  const ctx = await fixture();
  try {
    const result = await ctx.runtime.process({
      id: 'evt_persist_1',
      timestamp: '2026-07-29T12:03:00+03:00',
      text: 'Решили заморозить визуал и делать backend Djbrain.'
    });
    assert.equal(result.duplicate, false);
    assert.equal(result.state.eventCount, 1);
    assert.equal(result.state.episodeCount, 1);

    const restarted = new MemoryRuntime({ eventStore: ctx.events, snapshotStore: ctx.snapshots });
    await restarted.init();
    assert.equal(restarted.getState().eventCount, 1);
    assert.equal(restarted.getState().episodeCount, 1);
    assert.equal(restarted.getState().workingMemory.currentGoal, 'build_functional_digital_brain');
  } finally { await rm(ctx.dir, { recursive: true, force: true }); }
});

test('is idempotent for repeated event ids', async () => {
  const ctx = await fixture();
  try {
    const input = { id: 'evt_same', timestamp: '2026-07-29T12:04:00+03:00', text: 'Делаем backend мозга.' };
    await ctx.runtime.process(input);
    const duplicate = await ctx.runtime.process(input);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.state.eventCount, 1);
    const raw = await readFile(ctx.events.path, 'utf8');
    assert.equal(raw.trim().split(/\r?\n/).length, 1);
  } finally { await rm(ctx.dir, { recursive: true, force: true }); }
});

test('does not create an episode for a low-value acknowledgement', async () => {
  const ctx = await fixture();
  try {
    const result = await ctx.runtime.process({ id: 'evt_ack', timestamp: '2026-07-29T12:05:00+03:00', text: 'Окей.' });
    assert.equal(result.state.eventCount, 1);
    assert.equal(result.state.episodeCount, 0);
  } finally { await rm(ctx.dir, { recursive: true, force: true }); }
});

test('retrieves a prior project episode for a related turn', async () => {
  const ctx = await fixture();
  try {
    await ctx.runtime.process({ id: 'evt_old', timestamp: '2026-07-29T12:06:00+03:00', text: 'Решили делать backend Djbrain функция за функцией.' });
    const result = await ctx.runtime.process({ id: 'evt_new', timestamp: '2026-07-29T12:07:00+03:00', text: 'Продолжай backend Djbrain.' });
    assert.equal(result.memoryDecision.memoryNeeded, true);
    assert.ok(result.retrievedEpisodes.length >= 1);
    assert.equal(result.retrievedEpisodes[0].episode.sourceEventIds.includes('evt_old') || result.retrievedEpisodes[0].episode.sourceEventIds.includes('evt_new'), true);
  } finally { await rm(ctx.dir, { recursive: true, force: true }); }
});

test('refuses to silently recover from a corrupt event log', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'djbrain-corrupt-'));
  try {
    const path = join(dir, 'events.jsonl');
    await writeFile(path, '{not-json}\n', 'utf8');
    const runtime = new MemoryRuntime({ eventStore: new JsonlStore(path) });
    await assert.rejects(() => runtime.init(), /event_log_corrupt/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

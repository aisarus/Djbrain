import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalCognitiveSystem } from '../packages/cognitive-system/index.js';

test('unified system selects specialized memories, generates a response and persists a trace', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'djbrain-system-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const system = createLocalCognitiveSystem({
    dataDir: dir,
    clock: () => '2026-07-29T12:50:00+03:00',
    identitySeed: [{
      id: 'identity_direct',
      claim: 'Prefer direct execution over progress theatre.',
      applicableContexts: ['build_functional_digital_brain'],
      supportingPatternIds: ['pattern_1','pattern_2','pattern_3'],
      confidence: 0.94,
      stability: 0.9,
      reviewStatus: 'verified',
      sensitivity: 'private'
    }],
    relationshipSeed: [{
      personId: 'codex',
      role: 'colleague',
      trust: 'medium',
      closeness: 0.4,
      communicationPreferences: ['task_json_in_english'],
      evidenceEpisodeIds: ['episode_1'],
      confidence: 0.8,
      sensitivity: 'private'
    }],
    procedureSeed: [{
      id: 'procedure_backend',
      trigger: 'строить backend',
      contextTags: ['build_functional_digital_brain'],
      steps: [
        { action: 'inspect current repository state' },
        { action: 'implement a tested vertical slice' }
      ],
      successCount: 3,
      failureCount: 0,
      evidenceEpisodeIds: ['episode_1','episode_2','episode_3'],
      confidence: 0.8,
      status: 'verified',
      sensitivity: 'private'
    }]
  });
  await system.init();

  const result = await system.respond({
    id: 'evt_system_1',
    timestamp: '2026-07-29T12:50:00+03:00',
    text: 'Делаем backend мозга, продолжай строить backend до рабочего результата.'
  }, {
    personIds: ['codex'],
    privacyContext: { allowedPersonIds: ['codex'] },
    maxMemoryItems: 8
  });

  assert.equal(result.delivered, true);
  assert.equal(result.trace.status, 'succeeded');
  assert.ok(result.trace.stages.some((stage) => stage.stage === 'specialized_memory_selection'));
  assert.ok(result.context.memories.some((memory) => memory.type === 'identity_core'));
  assert.ok(result.context.memories.some((memory) => memory.type === 'relationship_model'));
  assert.ok(result.context.memories.some((memory) => memory.type === 'procedural_memory'));

  const traces = await system.api({ method: 'GET', path: '/v1/traces', query: { limit: 5 } });
  assert.equal(traces.status, 200);
  assert.equal(traces.body.count, 1);
});

test('semantic facts survive a complete runtime restart', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'djbrain-semantic-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const first = createLocalCognitiveSystem({ dataDir: dir, clock: () => '2026-07-29T12:51:00+03:00' });
  await first.init();
  const inserted = await first.addSemanticFact({
    id: 'fact_project_phase',
    subject: 'Djbrain',
    predicate: 'current_phase',
    value: 'backend_reconstruction',
    evidenceIds: ['episode_project_decision'],
    confidence: 0.95,
    status: 'verified',
    validFrom: '2026-07-29T12:00:00+03:00'
  });
  assert.equal(inserted.action, 'inserted');

  const second = createLocalCognitiveSystem({ dataDir: dir, clock: () => '2026-07-29T12:52:00+03:00' });
  await second.init();
  const facts = second.queryMemory({ facts: { subject: 'Djbrain', predicate: 'current_phase' } }).facts;
  assert.equal(facts.length, 1);
  assert.equal(facts[0].value, 'backend_reconstruction');
  assert.equal(second.getState().semanticMutationCount, 1);
});

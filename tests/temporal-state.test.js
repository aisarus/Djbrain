import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemporalStateRegistry, upsertTemporalState, resolveCurrentState, getStateHistory, detectTemporalConflicts } from '../packages/temporal-state/index.js';

test('supersedes an older current state', () => {
  const registry = createTemporalStateRegistry();
  upsertTemporalState(registry, {
    id: 'state_old', subject: 'user', stateType: 'residence', value: 'Bat Yam',
    observedAt: '2026-06-01T10:00:00Z', validFrom: '2026-06-01T10:00:00Z', evidenceIds: ['evt_1']
  });
  const result = upsertTemporalState(registry, {
    id: 'state_new', subject: 'user', stateType: 'residence', value: 'Ramat Gan',
    observedAt: '2026-06-25T10:00:00Z', validFrom: '2026-06-25T10:00:00Z', evidenceIds: ['evt_2']
  });

  assert.equal(result.action, 'superseded');
  assert.equal(resolveCurrentState(registry, 'user', 'residence').value, 'Ramat Gan');
  const history = getStateHistory(registry, 'user', 'residence');
  assert.equal(history.length, 2);
  assert.equal(history[0].status, 'historical');
  assert.equal(history[0].supersededBy, 'state_new');
  assert.deepEqual(history[1].supersedes, ['state_old']);
});

test('merges repeated evidence for the same current value', () => {
  const registry = createTemporalStateRegistry();
  upsertTemporalState(registry, {
    id: 'state_1', subject: 'project', stateType: 'phase', value: 'backend',
    observedAt: '2026-07-29T09:00:00Z', validFrom: '2026-07-29T09:00:00Z', evidenceIds: ['evt_a'], confidence: 0.7
  });
  const result = upsertTemporalState(registry, {
    id: 'state_2', subject: 'project', stateType: 'phase', value: 'backend',
    observedAt: '2026-07-29T10:00:00Z', validFrom: '2026-07-29T09:00:00Z', evidenceIds: ['evt_b'], confidence: 0.9
  });

  assert.equal(result.action, 'merged');
  assert.equal(registry.records.length, 1);
  assert.deepEqual(registry.records[0].evidenceIds.sort(), ['evt_a', 'evt_b']);
  assert.equal(registry.records[0].confidence, 0.9);
});

test('detects overlapping incompatible historical values', () => {
  const registry = createTemporalStateRegistry();
  registry.records.push(
    {
      schemaVersion: '1.0.0', id: 'a', subject: 'user', stateType: 'employment', value: 'A',
      observedAt: '2026-01-01T00:00:00Z', validFrom: '2026-01-01T00:00:00Z', validTo: '2026-03-01T00:00:00Z',
      status: 'historical', supersedes: [], supersededBy: null, confidence: 0.7, evidenceIds: [], sensitivity: 'private', verificationStatus: 'candidate'
    },
    {
      schemaVersion: '1.0.0', id: 'b', subject: 'user', stateType: 'employment', value: 'B',
      observedAt: '2026-02-01T00:00:00Z', validFrom: '2026-02-01T00:00:00Z', validTo: '2026-04-01T00:00:00Z',
      status: 'historical', supersedes: [], supersededBy: null, confidence: 0.7, evidenceIds: [], sensitivity: 'private', verificationStatus: 'candidate'
    }
  );
  const conflicts = detectTemporalConflicts(registry);
  assert.equal(conflicts.some((item) => item.type === 'overlapping_incompatible_values'), true);
});

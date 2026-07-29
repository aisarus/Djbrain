import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestBatch, createIngestionManifest } from '../packages/ingestion/index.js';
import { runBenchmark, compareBenchmarks } from '../packages/benchmark-harness/index.js';

test('ingestion quarantines invalid and duplicate records', () => {
  const records = [
    { id: 'f1', type: 'semantic_fact', schemaVersion: '1.0.0', provenance: { sourceId: 's1' }, confidence: 0.8 },
    { id: 'f1', type: 'semantic_fact', schemaVersion: '1.0.0', provenance: { sourceId: 's2' }, confidence: 0.7 },
    { id: 'bad', type: 'semantic_fact', schemaVersion: '1.0.0', provenance: {}, confidence: 2 }
  ];
  const batch = ingestBatch(records);
  assert.equal(batch.accepted.length, 1);
  assert.equal(batch.quarantined.length, 2);
  const manifest = createIngestionManifest(batch, { batchId: 'b1', createdAt: '2026-07-29T10:00:00Z' });
  assert.equal(manifest.batchId, 'b1');
  assert.equal(manifest.quarantined.length, 2);
});

test('benchmark harness reports improvements and regressions', async () => {
  const cases = [
    { id: 'a', input: 1, assertions: [{ path: 'value', op: 'equals', value: 1 }] },
    { id: 'b', input: 2, assertions: [{ path: 'value', op: 'equals', value: 2 }] }
  ];
  const baseline = await runBenchmark(cases, async (input) => ({ value: input === 1 ? 1 : 0 }));
  const candidate = await runBenchmark(cases, async (input) => ({ value: input }));
  const comparison = compareBenchmarks(baseline, candidate);
  assert.ok(comparison.passRateDelta > 0);
  assert.deepEqual(comparison.improvements, ['b']);
  assert.deepEqual(comparison.regressions, []);
});

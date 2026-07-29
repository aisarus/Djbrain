import test from 'node:test';
import assert from 'node:assert/strict';
import { arseniyBenchmarkV1, benchmarkMetadata } from '../benchmarks/arseniy-v1.js';
import { runArseniyBenchmarkV1 } from '../packages/benchmark-runner/arseniy-v1.js';

test('Arseniy benchmark v1 remains frozen at fifty scenarios', () => {
  assert.equal(benchmarkMetadata.scenarioCount, 50);
  assert.equal(arseniyBenchmarkV1.length, 50);
  assert.equal(new Set(arseniyBenchmarkV1.map((item) => item.id)).size, 50);
});

test('deterministic cognitive system clears the structural benchmark quality gate', async () => {
  const report = await runArseniyBenchmarkV1({
    generatedAt: '2026-07-29T13:59:00+03:00',
    includeOutputs: false
  });
  assert.equal(report.total, 50);
  assert.ok(report.passRate >= 0.9, `benchmark pass rate ${report.passRate}; failed: ${report.failedIds.join(', ')}`);
  assert.equal(report.categories.correction.total, 5);
  assert.equal(report.categories.privacy.total, 5);
  assert.equal(report.categories.robustness.total, 5);
});

export async function runBenchmark(cases, runner) {
  const results = [];
  for (const testCase of cases ?? []) {
    const startedAt = Date.now();
    try {
      const output = await runner(testCase.input, testCase);
      const assertions = evaluateAssertions(output, testCase.assertions ?? []);
      results.push({
        id: testCase.id,
        passed: assertions.every((item) => item.passed),
        assertions,
        durationMs: Date.now() - startedAt,
        output
      });
    } catch (error) {
      results.push({ id: testCase.id, passed: false, assertions: [], durationMs: Date.now() - startedAt, error: String(error?.message ?? error) });
    }
  }
  const passed = results.filter((item) => item.passed).length;
  return {
    schemaVersion: '1.0.0',
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length ? passed / results.length : 0,
    meanDurationMs: results.length ? results.reduce((sum, item) => sum + item.durationMs, 0) / results.length : 0,
    results
  };
}

export function compareBenchmarks(baseline, candidate) {
  return {
    baselinePassRate: baseline.passRate,
    candidatePassRate: candidate.passRate,
    passRateDelta: candidate.passRate - baseline.passRate,
    latencyDeltaMs: candidate.meanDurationMs - baseline.meanDurationMs,
    regressions: candidate.results
      .filter((result) => !result.passed && baseline.results.find((item) => item.id === result.id)?.passed)
      .map((result) => result.id),
    improvements: candidate.results
      .filter((result) => result.passed && baseline.results.find((item) => item.id === result.id)?.passed === false)
      .map((result) => result.id)
  };
}

function evaluateAssertions(output, assertions) {
  return assertions.map((assertion) => {
    const actual = readPath(output, assertion.path);
    let passed = false;
    if (assertion.op === 'equals') passed = deepEqual(actual, assertion.value);
    if (assertion.op === 'includes') passed = Array.isArray(actual) ? actual.includes(assertion.value) : String(actual ?? '').includes(String(assertion.value));
    if (assertion.op === 'gte') passed = Number(actual) >= Number(assertion.value);
    if (assertion.op === 'lte') passed = Number(actual) <= Number(assertion.value);
    if (assertion.op === 'exists') passed = actual !== undefined && actual !== null;
    return { ...assertion, actual, passed };
  });
}

function readPath(value, path) {
  return String(path ?? '').split('.').filter(Boolean).reduce((current, key) => current?.[key], value);
}
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

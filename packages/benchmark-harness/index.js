export async function runBenchmark(cases, runner, options = {}) {
  const results = [];
  for (const testCase of cases ?? []) {
    const startedAt = Date.now();
    try {
      const output = await runner(testCase.input, testCase);
      const assertions = evaluateAssertions(output, testCase.assertions ?? []);
      results.push({
        id: testCase.id,
        category: testCase.category ?? 'uncategorized',
        tags: testCase.tags ?? [],
        passed: assertions.every((item) => item.passed),
        assertions,
        durationMs: Date.now() - startedAt,
        output: options.includeOutputs === false ? undefined : output
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        category: testCase.category ?? 'uncategorized',
        tags: testCase.tags ?? [],
        passed: false,
        assertions: [],
        durationMs: Date.now() - startedAt,
        error: String(error?.message ?? error)
      });
    }
  }
  const passed = results.filter((item) => item.passed).length;
  return {
    schemaVersion: '1.1.0',
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: ratio(passed, results.length),
    meanDurationMs: mean(results.map((item) => item.durationMs)),
    categories: summarizeCategories(results),
    failedIds: results.filter((item) => !item.passed).map((item) => item.id),
    results
  };
}

export function compareBenchmarks(baseline, candidate) {
  const baselineById = new Map(baseline.results.map((item) => [item.id, item]));
  return {
    schemaVersion: '1.1.0',
    baselinePassRate: baseline.passRate,
    candidatePassRate: candidate.passRate,
    passRateDelta: candidate.passRate - baseline.passRate,
    latencyDeltaMs: candidate.meanDurationMs - baseline.meanDurationMs,
    regressions: candidate.results
      .filter((result) => !result.passed && baselineById.get(result.id)?.passed)
      .map((result) => result.id),
    improvements: candidate.results
      .filter((result) => result.passed && baselineById.get(result.id)?.passed === false)
      .map((result) => result.id),
    categoryDeltas: compareCategories(baseline.categories ?? {}, candidate.categories ?? {})
  };
}

export function evaluateAssertions(output, assertions) {
  return assertions.map((assertion) => {
    const actual = readPath(output, assertion.path);
    let passed = false;
    if (assertion.op === 'equals') passed = deepEqual(actual, assertion.value);
    if (assertion.op === 'notEquals') passed = !deepEqual(actual, assertion.value);
    if (assertion.op === 'includes') passed = Array.isArray(actual) ? actual.includes(assertion.value) : String(actual ?? '').includes(String(assertion.value));
    if (assertion.op === 'notIncludes') passed = Array.isArray(actual) ? !actual.includes(assertion.value) : !String(actual ?? '').includes(String(assertion.value));
    if (assertion.op === 'gte') passed = Number(actual) >= Number(assertion.value);
    if (assertion.op === 'lte') passed = Number(actual) <= Number(assertion.value);
    if (assertion.op === 'exists') passed = actual !== undefined && actual !== null;
    if (assertion.op === 'truthy') passed = Boolean(actual);
    if (assertion.op === 'falsy') passed = !actual;
    if (assertion.op === 'lengthEquals') passed = Array.isArray(actual) || typeof actual === 'string' ? actual.length === Number(assertion.value) : false;
    if (assertion.op === 'matches') passed = new RegExp(assertion.value, assertion.flags ?? '').test(String(actual ?? ''));
    return { ...assertion, actual, passed };
  });
}

function summarizeCategories(results) {
  const grouped = new Map();
  for (const result of results) {
    if (!grouped.has(result.category)) grouped.set(result.category, []);
    grouped.get(result.category).push(result);
  }
  return Object.fromEntries([...grouped.entries()].map(([category, items]) => {
    const passed = items.filter((item) => item.passed).length;
    return [category, {
      total: items.length,
      passed,
      failed: items.length - passed,
      passRate: ratio(passed, items.length),
      meanDurationMs: mean(items.map((item) => item.durationMs))
    }];
  }));
}

function compareCategories(baseline, candidate) {
  const categories = new Set([...Object.keys(baseline), ...Object.keys(candidate)]);
  return Object.fromEntries([...categories].map((category) => [category, {
    baseline: baseline[category]?.passRate ?? 0,
    candidate: candidate[category]?.passRate ?? 0,
    delta: (candidate[category]?.passRate ?? 0) - (baseline[category]?.passRate ?? 0)
  }]));
}

function readPath(value, path) {
  return String(path ?? '').split('.').filter(Boolean).reduce((current, key) => {
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    return current?.[key];
  }, value);
}
function ratio(value, total) { return total ? value / total : 0; }
function mean(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

export function evaluateRetrieval(cases, retrieve) {
  if (!Array.isArray(cases) || typeof retrieve !== 'function') throw new TypeError('cases and retrieve are required');
  const results = cases.map((testCase) => {
    const returned = retrieve(testCase.query).map((item) => item.episode?.id ?? item.id);
    const expected = new Set(testCase.expectedIds);
    const relevant = returned.filter((id) => expected.has(id));
    const precision = returned.length ? relevant.length / returned.length : expected.size === 0 ? 1 : 0;
    const recall = expected.size ? relevant.length / expected.size : returned.length === 0 ? 1 : 0;
    const reciprocalRank = (() => {
      const index = returned.findIndex((id) => expected.has(id));
      return index === -1 ? 0 : 1 / (index + 1);
    })();
    return { id: testCase.id, returned, precision, recall, reciprocalRank };
  });

  return {
    schemaVersion: '1.0.0',
    caseCount: results.length,
    precisionAtK: average(results.map((item) => item.precision)),
    recallAtK: average(results.map((item) => item.recall)),
    meanReciprocalRank: average(results.map((item) => item.reciprocalRank)),
    results
  };
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

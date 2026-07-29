import test from 'node:test';
import assert from 'node:assert/strict';
import { hybridRetrieve, createHashVectorScorer, evaluateRankedRetrieval } from '../packages/hybrid-retrieval/index.js';

const memories = [
  {
    id: 'm_backend',
    layer: 'semantic_memory',
    subject: 'Djbrain',
    predicate: 'current_phase',
    value: 'functional backend reconstruction',
    entities: ['Djbrain','backend'],
    confidence: 0.95,
    importance: 0.9,
    status: 'current',
    validFrom: '2026-07-29T12:00:00+03:00'
  },
  {
    id: 'm_visual',
    layer: 'semantic_memory',
    subject: 'Djbrain',
    predicate: 'current_phase',
    value: 'visual interface expansion',
    entities: ['Djbrain','visual'],
    confidence: 0.7,
    importance: 0.5,
    status: 'superseded',
    validFrom: '2026-07-28T12:00:00+03:00'
  },
  {
    id: 'm_data',
    layer: 'episodic_memory',
    summary: 'Codex prepares and cleans the cognitive dataset in parallel.',
    entities: ['Codex','data_pipeline'],
    topics: ['cognitive_data'],
    confidence: 0.9,
    importance: 0.8,
    timeEnd: '2026-07-29T11:00:00+03:00'
  },
  {
    id: 'm_home',
    layer: 'temporal_state',
    stateType: 'residence',
    value: 'Ramat Gan',
    entities: ['user'],
    confidence: 0.98,
    status: 'current',
    validFrom: '2026-06-25T00:00:00+03:00'
  }
];

test('hybrid retrieval ranks current backend memory over superseded visual memory', async () => {
  const results = await hybridRetrieve({
    query: { text: 'продолжай строить backend мозга', entities: ['Djbrain','backend'] },
    memories,
    vectorScorer: createHashVectorScorer(),
    now: '2026-07-29T12:22:00+03:00',
    limit: 3
  });
  assert.equal(results[0].id, 'm_backend');
  assert.ok(results.find((item) => item.id === 'm_visual').components.contradictionPenalty > 0);
});

test('hybrid retrieval finds data pipeline memory for corpus preparation query', async () => {
  const results = await hybridRetrieve({
    query: { text: 'что делает кодекс с данными и корпусом', entities: ['Codex','data_pipeline'] },
    memories,
    vectorScorer: createHashVectorScorer(),
    now: '2026-07-29T12:22:00+03:00',
    limit: 2
  });
  assert.equal(results[0].id, 'm_data');
});

test('retrieval evaluation reports perfect ranking for controlled cases', async () => {
  const cases = [];
  for (const [query, relevantIds] of [
    [{ text: 'backend мозга', entities: ['backend'] }, ['m_backend']],
    [{ text: 'подготовка данных кодексом', entities: ['Codex','data_pipeline'] }, ['m_data']],
    [{ text: 'где сейчас живет пользователь', entities: ['user'] }, ['m_home']]
  ]) {
    cases.push({ query, relevantIds, results: await hybridRetrieve({ query, memories, vectorScorer: createHashVectorScorer(), now: '2026-07-29T12:22:00+03:00', limit: 5 }) });
  }
  const metrics = evaluateRankedRetrieval(cases);
  assert.equal(metrics.hitAt1, 1);
  assert.equal(metrics.hitAt5, 1);
  assert.equal(metrics.mrr, 1);
});

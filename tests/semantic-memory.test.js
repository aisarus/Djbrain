import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticStore, upsertSemanticFact, querySemanticFacts, validateSemanticStore } from '../packages/semantic-memory/index.js';
import { proposeSemanticFacts, detectProposalConflicts } from '../packages/consolidation/index.js';
import { evaluateRetrieval } from '../packages/retrieval-evaluation/index.js';

test('reinforces identical facts instead of duplicating them', () => {
  const store = createSemanticStore();
  upsertSemanticFact(store, { id: 'f1', subject: 'user', predicate: 'residence', value: 'Bat Yam', evidenceIds: ['e1'], confidence: 0.7 });
  const result = upsertSemanticFact(store, { id: 'f2', subject: 'user', predicate: 'residence', value: 'Bat Yam', evidenceIds: ['e2'], confidence: 0.8 });
  assert.equal(result.action, 'reinforced');
  assert.equal(store.facts.length, 1);
  assert.deepEqual(store.facts[0].evidenceIds, ['e1', 'e2']);
});

test('keeps contradictory facts pending without silent overwrite', () => {
  const store = createSemanticStore();
  upsertSemanticFact(store, { id: 'old', subject: 'user', predicate: 'residence', value: 'Bat Yam', evidenceIds: ['e1'], status: 'verified' });
  const result = upsertSemanticFact(store, { id: 'new', subject: 'user', predicate: 'residence', value: 'Ramat Gan', evidenceIds: ['e2'] });
  assert.equal(result.action, 'conflict_pending');
  assert.deepEqual(result.conflicts, ['old']);
});

test('can explicitly supersede an old fact', () => {
  const store = createSemanticStore();
  upsertSemanticFact(store, { id: 'old', subject: 'user', predicate: 'residence', value: 'Bat Yam', evidenceIds: ['e1'], status: 'verified' });
  const result = upsertSemanticFact(store, { id: 'new', subject: 'user', predicate: 'residence', value: 'Ramat Gan', evidenceIds: ['e2'], validFrom: '2026-06-25' }, { autoSupersede: true });
  assert.equal(result.action, 'superseded');
  assert.equal(querySemanticFacts(store, { subject: 'user', predicate: 'residence' })[0].id, 'new');
  assert.equal(validateSemanticStore(store).valid, true);
});

test('consolidation requires repeated episode support', () => {
  const episodes = [
    { id: 'e1', entities: ['Djbrain'], topics: ['backend'] },
    { id: 'e2', entities: ['Djbrain'], topics: ['backend'] },
    { id: 'e3', entities: ['Djbrain'], topics: ['visual'] }
  ];
  const proposals = proposeSemanticFacts(episodes, { minSupport: 2 });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].value, 'backend');
  const store = createSemanticStore([{ id: 'f1', subject: 'Djbrain', predicate: 'related_topic', value: 'visual', evidenceIds: ['e0'] }]);
  assert.equal(detectProposalConflicts(proposals, store)[0].risk, 'high');
});

test('retrieval evaluation computes precision recall and reciprocal rank', () => {
  const report = evaluateRetrieval([
    { id: 'c1', query: {}, expectedIds: ['e2'] }
  ], () => [{ id: 'e1' }, { id: 'e2' }]);
  assert.equal(report.precisionAtK, 0.5);
  assert.equal(report.recallAtK, 1);
  assert.equal(report.meanReciprocalRank, 0.5);
});

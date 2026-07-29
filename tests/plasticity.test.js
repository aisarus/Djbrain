import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackEvent, proposeMemoryUpdates, applyUpdateProposal, revertUpdate } from '../packages/plasticity/index.js';

test('feedback creates targeted reversible proposals', () => {
  const feedback = createFeedbackEvent({
    id: 'fb1',
    turnId: 'turn1',
    rating: -1,
    errorLabels: ['irrelevant_memory', 'outdated_fact'],
    selectedMemoryIds: ['m1'],
    correctedResponse: 'Use only current project context.'
  });
  const proposals = proposeMemoryUpdates(feedback);
  assert.equal(proposals.length, 3);
  assert.ok(proposals.every((proposal) => proposal.approvalStatus === 'pending'));
});

test('unapproved proposal cannot mutate state', () => {
  const proposal = proposeMemoryUpdates(createFeedbackEvent({ turnId: 't1', errorLabels: ['irrelevant_memory'] }))[0];
  const result = applyUpdateProposal({ appliedUpdates: [] }, proposal);
  assert.equal(result.applied, false);
});

test('approved proposal applies and can be reverted', () => {
  const proposal = proposeMemoryUpdates(createFeedbackEvent({ id: 'fb2', turnId: 't2', errorLabels: ['irrelevant_memory'], selectedMemoryIds: ['m1'] }))[0];
  proposal.approvalStatus = 'approved';
  const result = applyUpdateProposal({ appliedUpdates: [] }, proposal);
  assert.equal(result.applied, true);
  assert.equal(result.state.appliedUpdates.length, 1);
  assert.equal(revertUpdate(result.state, result.inverse).appliedUpdates.length, 0);
});

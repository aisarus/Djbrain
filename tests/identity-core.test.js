import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityCore, selectIdentityClaims, proposeIdentityUpdate, applyIdentityProposal } from '../packages/identity-core/index.js';

test('selects only context relevant verified identity claims', () => {
  const core = createIdentityCore([
    {
      id: 'directness',
      claim: 'Prefers direct technical answers without ceremonial framing.',
      applicableContexts: ['technical_coarchitecture'],
      supportingPatternIds: ['p1','p2','p3'],
      confidence: 0.94,
      stability: 0.9,
      reviewStatus: 'verified'
    },
    {
      id: 'food',
      claim: 'Prefers vegan home cooking.',
      applicableContexts: ['cooking'],
      supportingPatternIds: ['p4','p5'],
      confidence: 0.9,
      stability: 0.85,
      reviewStatus: 'verified'
    },
    {
      id: 'candidate',
      claim: 'Unverified temporary preference.',
      applicableContexts: ['technical_coarchitecture'],
      confidence: 0.6,
      reviewStatus: 'candidate'
    }
  ]);
  const selected = selectIdentityClaims(core, { contexts: ['technical_coarchitecture'] });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].claim.id, 'directness');
});

test('single observation cannot rewrite identity core', () => {
  const core = createIdentityCore();
  const proposal = proposeIdentityUpdate(core, {
    claim: 'Always prefers extremely long responses.',
    supportingPatternIds: ['single_event'],
    confidence: 0.95
  });
  assert.equal(proposal.eligibleForReview, false);
  assert.throws(() => applyIdentityProposal(core, proposal.id), /proposal_insufficient_evidence/);
});

test('repeated evidence can create a reviewable identity proposal', () => {
  const core = createIdentityCore();
  const proposal = proposeIdentityUpdate(core, {
    claim: 'Prefers executable progress over architecture-only discussion.',
    supportingPatternIds: ['p1','p2','p3','p4'],
    counterEvidenceIds: [],
    confidence: 0.96
  });
  assert.equal(proposal.eligibleForReview, true);
  const claim = applyIdentityProposal(core, proposal.id, { approvedBy: 'user', reviewedAt: '2026-07-29T12:22:00+03:00' });
  assert.equal(claim.reviewStatus, 'verified');
  assert.equal(core.claims.length, 1);
  assert.equal(claim.provenance.proposalId, proposal.id);
});

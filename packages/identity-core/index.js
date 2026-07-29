const REVIEW_STATUSES = new Set(['candidate','verified','rejected','superseded']);

export function createIdentityClaim(input) {
  if (!input?.claim) throw new TypeError('claim is required');
  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `identity_${crypto.randomUUID()}`,
    claim: String(input.claim).trim(),
    applicableContexts: unique(input.applicableContexts ?? []),
    exceptions: unique(input.exceptions ?? []),
    supportingPatternIds: unique(input.supportingPatternIds ?? []),
    counterEvidenceIds: unique(input.counterEvidenceIds ?? []),
    confidence: clamp(input.confidence ?? 0.5),
    stability: clamp(input.stability ?? 0.5),
    sensitivity: input.sensitivity ?? 'private',
    reviewStatus: REVIEW_STATUSES.has(input.reviewStatus) ? input.reviewStatus : 'candidate',
    changeThreshold: clamp(input.changeThreshold ?? 0.75),
    lastReviewedAt: input.lastReviewedAt ?? null,
    provenance: input.provenance ?? { sourceType: 'behavioral_patterns' }
  };
}

export function createIdentityCore(seed = []) {
  return { schemaVersion: '1.0.0', claims: seed.map(createIdentityClaim), proposals: [] };
}

export function selectIdentityClaims(core, context = {}, options = {}) {
  const limit = options.limit ?? 4;
  const allowCandidates = options.allowCandidates === true;
  const contexts = new Set([...(context.contexts ?? []), context.situationType, context.relationshipMode, context.currentGoal].filter(Boolean));
  return core.claims
    .filter((claim) => claim.reviewStatus === 'verified' || (allowCandidates && claim.reviewStatus === 'candidate'))
    .filter((claim) => !claim.applicableContexts.length || claim.applicableContexts.some((item) => contexts.has(item)))
    .filter((claim) => !claim.exceptions.some((item) => contexts.has(item)))
    .map((claim) => ({ claim, score: activationScore(claim, contexts) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function proposeIdentityUpdate(core, observation, options = {}) {
  if (!observation?.claim) throw new TypeError('observation.claim is required');
  const similar = core.claims.find((claim) => normalize(claim.claim) === normalize(observation.claim));
  const evidenceCount = unique(observation.supportingPatternIds ?? []).length;
  const counterCount = unique(observation.counterEvidenceIds ?? []).length;
  const supportRatio = evidenceCount / Math.max(1, evidenceCount + counterCount);
  const requiredEvidence = options.requiredEvidence ?? 3;
  const confidence = clamp((observation.confidence ?? 0.5) * 0.6 + supportRatio * 0.4);
  const proposal = {
    id: `identity_proposal_${crypto.randomUUID()}`,
    operation: similar ? 'reinforce_or_revise' : 'create',
    targetClaimId: similar?.id ?? null,
    proposedClaim: observation.claim,
    supportingPatternIds: unique(observation.supportingPatternIds ?? []),
    counterEvidenceIds: unique(observation.counterEvidenceIds ?? []),
    confidence,
    evidenceCount,
    eligibleForReview: evidenceCount >= requiredEvidence && confidence >= (similar?.changeThreshold ?? 0.75),
    approvalStatus: 'pending'
  };
  core.proposals.push(proposal);
  return proposal;
}

export function applyIdentityProposal(core, proposalId, { approvedBy = 'user', reviewedAt = new Date().toISOString() } = {}) {
  const proposal = core.proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error('proposal_not_found');
  if (!proposal.eligibleForReview) throw new Error('proposal_insufficient_evidence');
  if (proposal.approvalStatus !== 'pending') throw new Error('proposal_already_resolved');

  proposal.approvalStatus = 'approved';
  proposal.approvedBy = approvedBy;
  proposal.reviewedAt = reviewedAt;
  const existing = proposal.targetClaimId ? core.claims.find((claim) => claim.id === proposal.targetClaimId) : null;
  if (existing) {
    existing.supportingPatternIds = unique([...existing.supportingPatternIds, ...proposal.supportingPatternIds]);
    existing.counterEvidenceIds = unique([...existing.counterEvidenceIds, ...proposal.counterEvidenceIds]);
    existing.confidence = Math.max(existing.confidence, proposal.confidence);
    existing.lastReviewedAt = reviewedAt;
    existing.reviewStatus = 'verified';
    return existing;
  }
  const claim = createIdentityClaim({
    claim: proposal.proposedClaim,
    supportingPatternIds: proposal.supportingPatternIds,
    counterEvidenceIds: proposal.counterEvidenceIds,
    confidence: proposal.confidence,
    stability: 0.55,
    reviewStatus: 'verified',
    lastReviewedAt: reviewedAt,
    provenance: { sourceType: 'approved_identity_proposal', proposalId }
  });
  core.claims.push(claim);
  return claim;
}

export function rejectIdentityProposal(core, proposalId, reason = 'rejected_by_reviewer') {
  const proposal = core.proposals.find((item) => item.id === proposalId);
  if (!proposal) throw new Error('proposal_not_found');
  proposal.approvalStatus = 'rejected';
  proposal.rejectionReason = reason;
  return proposal;
}

function activationScore(claim, contexts) {
  const overlap = claim.applicableContexts.filter((item) => contexts.has(item)).length;
  const evidenceBalance = claim.supportingPatternIds.length / Math.max(1, claim.supportingPatternIds.length + claim.counterEvidenceIds.length);
  return Number((overlap * 0.3 + claim.confidence * 0.3 + claim.stability * 0.2 + evidenceBalance * 0.2).toFixed(3));
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function normalize(value) { return String(value).toLowerCase().replace(/\s+/g, ' ').trim(); }
function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }

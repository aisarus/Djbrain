export function createFeedbackEvent(input) {
  if (!input?.turnId) throw new TypeError('turnId is required');
  return {
    schemaVersion: '1.0.0',
    id: input.id ?? `feedback_${crypto.randomUUID()}`,
    turnId: input.turnId,
    rating: normalizeRating(input.rating),
    errorLabels: [...new Set(input.errorLabels ?? [])],
    correctedResponse: input.correctedResponse ?? null,
    selectedMemoryIds: [...new Set(input.selectedMemoryIds ?? [])],
    timestamp: input.timestamp ?? new Date().toISOString(),
    provenance: input.provenance ?? { sourceType: 'direct_feedback' }
  };
}

export function proposeMemoryUpdates(feedback, context = {}) {
  if (!feedback) throw new TypeError('feedback is required');
  const proposals = [];

  if (feedback.errorLabels.includes('irrelevant_memory')) {
    proposals.push(proposal('adjust_retrieval_weight', {
      targetIds: feedback.selectedMemoryIds,
      delta: -0.15,
      reason: 'memory_was_irrelevant',
      risk: 'low'
    }, feedback));
  }

  if (feedback.errorLabels.includes('outdated_fact')) {
    proposals.push(proposal('mark_fact_for_temporal_review', {
      targetIds: feedback.selectedMemoryIds,
      reason: 'fact_may_be_outdated',
      risk: 'high'
    }, feedback));
  }

  if (feedback.errorLabels.includes('tone_mismatch')) {
    proposals.push(proposal('adjust_strategy_preference', {
      targetIds: context.strategyIds ?? [],
      delta: -0.1,
      reason: 'tone_mismatch',
      risk: 'medium'
    }, feedback));
  }

  if (feedback.correctedResponse) {
    proposals.push(proposal('store_correction_example', {
      value: feedback.correctedResponse,
      reason: 'explicit_corrected_response',
      risk: 'medium'
    }, feedback));
  }

  return proposals;
}

export function applyUpdateProposal(state, input) {
  const proposal = structuredClone(input);
  if (!proposal?.id) throw new TypeError('proposal is required');
  if (proposal.approvalStatus !== 'approved') return { applied: false, reason: 'approval_required', state };

  const next = structuredClone(state);
  next.appliedUpdates ??= [];
  next.appliedUpdates.push({
    proposalId: proposal.id,
    operation: proposal.operation,
    payload: proposal.payload,
    appliedAt: proposal.approvedAt ?? new Date().toISOString()
  });
  return { applied: true, state: next, inverse: inverseOf(proposal) };
}

export function revertUpdate(state, inverse) {
  const next = structuredClone(state);
  next.appliedUpdates = (next.appliedUpdates ?? []).filter((entry) => entry.proposalId !== inverse.proposalId);
  return next;
}

function proposal(operation, payload, feedback) {
  return {
    schemaVersion: '1.0.0',
    id: `update_${crypto.randomUUID()}`,
    operation,
    payload,
    evidenceIds: [feedback.id],
    confidence: feedback.rating < 0 ? 0.8 : 0.6,
    approvalStatus: 'pending',
    createdAt: feedback.timestamp
  };
}

function inverseOf(proposal) {
  return { proposalId: proposal.id, operation: `revert_${proposal.operation}` };
}

function normalizeRating(value) {
  const number = Number(value ?? 0);
  return Math.max(-1, Math.min(1, number));
}

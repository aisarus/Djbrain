export function createProcedure(input) {
  if (!input?.id || !input?.trigger || !Array.isArray(input.steps) || input.steps.length === 0) {
    throw new TypeError('id, trigger and non-empty steps are required');
  }
  return {
    schemaVersion: '1.0.0',
    id: input.id,
    trigger: input.trigger,
    contextTags: unique(input.contextTags ?? []),
    steps: input.steps.map((step, index) => ({
      order: index + 1,
      action: String(step.action ?? step),
      preconditions: unique(step.preconditions ?? []),
      expectedOutcome: step.expectedOutcome ?? null
    })),
    successCount: Number(input.successCount ?? 0),
    failureCount: Number(input.failureCount ?? 0),
    evidenceEpisodeIds: unique(input.evidenceEpisodeIds ?? []),
    confidence: clamp(input.confidence ?? 0.5),
    status: input.status ?? 'candidate',
    updatedAt: input.updatedAt ?? new Date().toISOString()
  };
}

export function createProcedureStore(seed = []) {
  return { schemaVersion: '1.0.0', procedures: seed.map(createProcedure) };
}

export function recordProcedureOutcome(store, id, { success, episodeId }) {
  const procedure = store.procedures.find((item) => item.id === id);
  if (!procedure) throw new Error(`procedure_not_found:${id}`);
  if (success) procedure.successCount += 1;
  else procedure.failureCount += 1;
  if (episodeId) procedure.evidenceEpisodeIds = unique([...procedure.evidenceEpisodeIds, episodeId]);
  const attempts = procedure.successCount + procedure.failureCount;
  procedure.confidence = clamp((procedure.successCount + 1) / (attempts + 2));
  procedure.status = attempts >= 3 && procedure.confidence >= 0.7 ? 'verified' : 'candidate';
  procedure.updatedAt = new Date().toISOString();
  return procedure;
}

export function retrieveProcedures(store, query = {}) {
  const tags = query.contextTags ?? [];
  const trigger = String(query.trigger ?? '').toLowerCase();
  return store.procedures
    .map((procedure) => ({
      procedure,
      score: scoreProcedure(procedure, trigger, tags)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit ?? 3);
}

function scoreProcedure(procedure, trigger, tags) {
  const triggerScore = trigger && procedure.trigger.toLowerCase().includes(trigger) ? 0.5 : 0;
  const tagScore = tags.length ? intersection(procedure.contextTags, tags) / tags.length * 0.25 : 0;
  return triggerScore + tagScore + procedure.confidence * 0.2 + (procedure.status === 'verified' ? 0.05 : 0);
}
function intersection(a, b) { return a.filter((value) => b.includes(value)).length; }
function clamp(value) { return Math.max(0, Math.min(1, Number(value))); }
function unique(values) { return [...new Set(values.filter(Boolean))]; }

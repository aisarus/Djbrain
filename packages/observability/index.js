export function createTrace(runId, timestamp = new Date().toISOString()) {
  if (!runId) throw new TypeError('runId is required');
  return {
    id: runId,
    schemaVersion: '1.1.0',
    runId,
    startedAt: timestamp,
    finishedAt: null,
    status: 'running',
    stages: [],
    errors: [],
    metrics: {}
  };
}

export function recordStage(trace, stage, payload = {}, timing = {}) {
  if (!trace || trace.status !== 'running') throw new TypeError('active trace is required');
  const entry = {
    stage,
    startedAt: timing.startedAt ?? new Date().toISOString(),
    finishedAt: timing.finishedAt ?? new Date().toISOString(),
    durationMs: Math.max(0, Number(timing.durationMs ?? 0)),
    inputRefs: unique(payload.inputRefs ?? []),
    outputRefs: unique(payload.outputRefs ?? []),
    decision: payload.decision ?? null,
    confidence: payload.confidence ?? null,
    reason: payload.reason ?? null,
    warnings: unique(payload.warnings ?? [])
  };
  trace.stages.push(entry);
  return entry;
}

export function finishTrace(trace, { status = 'succeeded', metrics = {}, errors = [], finishedAt = new Date().toISOString() } = {}) {
  if (!trace || trace.status !== 'running') throw new TypeError('active trace is required');
  trace.status = status;
  trace.finishedAt = finishedAt;
  trace.metrics = { ...trace.metrics, ...metrics };
  trace.errors.push(...errors);
  return trace;
}

export function summarizeTrace(trace) {
  return {
    id: trace.id,
    runId: trace.runId,
    status: trace.status,
    stageCount: trace.stages.length,
    totalDurationMs: trace.stages.reduce((sum, stage) => sum + stage.durationMs, 0),
    warnings: unique(trace.stages.flatMap((stage) => stage.warnings)),
    errors: [...trace.errors],
    metrics: { ...trace.metrics }
  };
}

function unique(values) { return [...new Set(values.filter(Boolean))]; }

export function createTrace(runId, timestamp = new Date().toISOString()) {
  return {
    schemaVersion: '1.0.0',
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
    durationMs: Number(timing.durationMs ?? 0),
    inputRefs: payload.inputRefs ?? [],
    outputRefs: payload.outputRefs ?? [],
    decision: payload.decision ?? null,
    confidence: payload.confidence ?? null,
    reason: payload.reason ?? null,
    warnings: payload.warnings ?? []
  };
  trace.stages.push(entry);
  return entry;
}

export function finishTrace(trace, { status = 'succeeded', metrics = {}, errors = [] } = {}) {
  trace.status = status;
  trace.finishedAt = new Date().toISOString();
  trace.metrics = { ...trace.metrics, ...metrics };
  trace.errors.push(...errors);
  return trace;
}

export function summarizeTrace(trace) {
  return {
    runId: trace.runId,
    status: trace.status,
    stageCount: trace.stages.length,
    totalDurationMs: trace.stages.reduce((sum, stage) => sum + stage.durationMs, 0),
    warnings: trace.stages.flatMap((stage) => stage.warnings),
    errors: [...trace.errors]
  };
}

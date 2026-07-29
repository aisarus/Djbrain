export function createConsolidationScheduler(options = {}) {
  return {
    schemaVersion: '1.0.0',
    minEpisodeAgeMs: options.minEpisodeAgeMs ?? 60 * 60 * 1000,
    maxBatchSize: options.maxBatchSize ?? 100,
    replayIntervalMs: options.replayIntervalMs ?? 24 * 60 * 60 * 1000,
    lastRunAt: options.lastRunAt ?? null
  };
}

export function planConsolidation(scheduler, episodes, now = new Date().toISOString()) {
  const nowMs = Date.parse(now);
  const eligible = episodes
    .filter((episode) => episode.status !== 'quarantined')
    .filter((episode) => nowMs - Date.parse(episode.timeEnd) >= scheduler.minEpisodeAgeMs)
    .filter((episode) => episode.importance >= 0.42 || episode.correctionStrength >= 0.5)
    .sort((a, b) => priority(b, nowMs) - priority(a, nowMs))
    .slice(0, scheduler.maxBatchSize);

  return {
    schemaVersion: '1.0.0',
    plannedAt: now,
    episodeIds: eligible.map((episode) => episode.id),
    priorities: eligible.map((episode) => ({ id: episode.id, score: priority(episode, nowMs) })),
    shouldRun: eligible.length > 0 && due(scheduler, nowMs)
  };
}

export function markConsolidationRun(scheduler, timestamp = new Date().toISOString()) {
  scheduler.lastRunAt = timestamp;
  return scheduler;
}

function due(scheduler, nowMs) {
  if (!scheduler.lastRunAt) return true;
  return nowMs - Date.parse(scheduler.lastRunAt) >= scheduler.replayIntervalMs;
}

function priority(episode, nowMs) {
  const ageDays = Math.max(0, (nowMs - Date.parse(episode.timeEnd)) / 86400000);
  const recency = 1 / (1 + ageDays / 30);
  return Number((episode.importance * 0.45 + episode.novelty * 0.2 + episode.correctionStrength * 0.25 + recency * 0.1).toFixed(4));
}

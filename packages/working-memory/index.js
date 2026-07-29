export function createWorkingMemory(seed = {}) {
  return {
    schemaVersion: '1.0.0',
    version: 0,
    currentGoal: seed.currentGoal ?? null,
    currentSubgoal: seed.currentSubgoal ?? null,
    activeEntities: seed.activeEntities ?? [],
    constraints: seed.constraints ?? [],
    openQuestions: seed.openQuestions ?? [],
    recentDecisions: seed.recentDecisions ?? [],
    recentEvents: seed.recentEvents ?? [],
    updatedAt: seed.updatedAt ?? null
  };
}

export function updateWorkingMemory(state, event, options = {}) {
  if (!state || !event) throw new TypeError('state and event are required');
  const eventLimit = options.eventLimit ?? 12;
  const decisionLimit = options.decisionLimit ?? 8;
  const next = structuredClone(state);

  next.version += 1;
  next.updatedAt = event.timestamp;
  next.activeEntities = unique([...event.entities, ...next.activeEntities]).slice(0, 12);
  next.recentEvents = [summarizeEvent(event), ...next.recentEvents].slice(0, eventLimit);

  if (event.intent === 'set_project_direction') {
    next.currentGoal = inferGoal(event);
    next.currentSubgoal = inferSubgoal(event);
    next.recentDecisions = unique([...event.decisions, ...next.recentDecisions]).slice(0, decisionLimit);
  }

  if (event.intent === 'correct_previous_behavior') {
    next.constraints = unique([...event.corrections.map(toConstraint), ...next.constraints]).slice(0, 12);
  }

  if (event.speechAct === 'question') {
    next.openQuestions = unique([event.text, ...next.openQuestions]).slice(0, 8);
  } else if (event.speechAct === 'decision' || event.speechAct === 'request') {
    next.openQuestions = next.openQuestions.filter((question) => question !== event.text);
  }

  return next;
}

export function validateWorkingMemory(state) {
  const errors = [];
  if (state?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (!Number.isInteger(state?.version) || state.version < 0) errors.push('invalid_version');
  for (const key of ['activeEntities','constraints','openQuestions','recentDecisions','recentEvents']) {
    if (!Array.isArray(state?.[key])) errors.push(`invalid_${key}`);
  }
  return { valid: errors.length === 0, errors };
}

function summarizeEvent(event) {
  return { id: event.id, timestamp: event.timestamp, intent: event.intent, speechAct: event.speechAct, entities: event.entities };
}

function inferGoal(event) {
  if (event.entities.includes('backend') || /бэкенд|backend/i.test(event.text)) return 'build_functional_digital_brain';
  if (event.entities.includes('data_pipeline')) return 'prepare_cognitive_data';
  return event.decisions[0] ?? event.text;
}

function inferSubgoal(event) {
  if (/функц/i.test(event.text)) return 'reconstruct_cognitive_functions_incrementally';
  if (/выполня|приступ/i.test(event.text)) return 'implement_first_cognitive_loop';
  return null;
}

function toConstraint(text) {
  return `avoid:${text.trim().replace(/\s+/g, '_').slice(0, 96)}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

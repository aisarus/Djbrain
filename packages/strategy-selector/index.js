export function selectResponseStrategy({ event, situation, memoryDecision, memories = [], privacyReport = null } = {}) {
  if (!event || !situation || !memoryDecision) throw new TypeError('event, situation and memoryDecision are required');

  const move = chooseMove(event, situation);
  const detail = chooseDetail(event, situation);
  const tone = chooseTone(event);
  const memoryUse = memoryDecision.memoryNeeded && memories.length > 0 ? 'use_selected_memory' : 'answer_without_long_term_memory';
  const blockedMemoryCount = privacyReport?.blocked?.length ?? 0;

  return {
    schemaVersion: '1.0.0',
    eventId: event.id,
    move,
    tone,
    detail,
    memoryUse,
    citeMemoryInternally: memories.length > 0,
    blockedMemoryCount,
    objectives: objectives(move),
    avoid: inferAvoid(event, situation),
    confidence: confidence(event, situation, blockedMemoryCount)
  };
}

export function validateResponseStrategy(strategy) {
  const errors = [];
  for (const key of ['eventId','move','tone','detail','memoryUse']) if (!strategy?.[key]) errors.push(`missing_${key}`);
  if (!Array.isArray(strategy?.objectives)) errors.push('invalid_objectives');
  if (!Array.isArray(strategy?.avoid)) errors.push('invalid_avoid');
  if (typeof strategy?.confidence !== 'number' || strategy.confidence < 0 || strategy.confidence > 1) errors.push('invalid_confidence');
  return { valid: errors.length === 0, errors };
}

function chooseMove(event, situation) {
  if (event.intent === 'correct_previous_behavior') return 'acknowledge_repair_and_act';
  if (event.speechAct === 'feedback') return 'integrate_feedback';
  if (event.intent === 'set_project_direction') return 'confirm_direction_and_execute';
  if (event.intent === 'request_action') return 'perform_action';
  if (event.intent === 'ask_information') return 'direct_answer';
  if (situation.currentGoal === 'build_functional_digital_brain') return 'advance_active_goal';
  return 'contextual_response';
}

function chooseDetail(event, situation) {
  if (/коротко|вкратце|без подроб/i.test(event.text)) return 'brief';
  if (/подроб|полностью|максимально|комплекс/i.test(event.text)) return 'deep';
  if (situation.currentStage?.includes('reconstruct')) return 'substantial';
  return 'medium';
}

function chooseTone(event) {
  if (event.tone === 'intense_direct') return 'direct_energetic';
  if (event.tone === 'positive') return 'warm_direct';
  return 'direct';
}

function objectives(move) {
  const map = {
    acknowledge_repair_and_act: ['acknowledge_error','state_concrete_repair','perform_next_action'],
    integrate_feedback: ['extract_feedback','avoid_defensiveness','update_future_behavior'],
    confirm_direction_and_execute: ['preserve_decision','avoid_replanning','execute'],
    perform_action: ['complete_requested_action','report_only_material_results'],
    direct_answer: ['answer_question','avoid_unrelated_memory'],
    advance_active_goal: ['continue_from_current_state','produce_executable_progress']
  };
  return map[move] ?? ['respond_relevantly'];
}

function inferAvoid(event, situation) {
  const avoid = ['invented_facts','irrelevant_personal_memory','unsupported_certainty'];
  if (situation.mainRisk) avoid.push(situation.mainRisk);
  if (event.intent === 'request_action') avoid.push('plan_only_response');
  if (event.intent === 'correct_previous_behavior') avoid.push('repeat_corrected_behavior');
  return [...new Set(avoid)];
}

function confidence(event, situation, blocked) {
  let value = event.confidence * 0.55 + (1 - situation.uncertainty) * 0.45 - Math.min(0.2, blocked * 0.03);
  return Number(Math.max(0.05, Math.min(0.99, value)).toFixed(2));
}

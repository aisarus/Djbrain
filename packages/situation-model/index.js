export function buildSituationModel(event, workingMemory) {
  if (!event || !workingMemory) throw new TypeError('event and workingMemory are required');

  const currentGoal = workingMemory.currentGoal ?? inferGoal(event);
  const currentStage = inferStage(event, workingMemory);
  const userGoal = inferUserGoal(event, currentGoal);
  const expectedResponse = inferExpectedResponse(event);
  const mainRisk = inferMainRisk(event, workingMemory);

  return {
    schemaVersion: '1.0.0',
    eventId: event.id,
    timestamp: event.timestamp,
    userGoal,
    systemRole: 'technical_coarchitect',
    currentGoal,
    currentStage,
    expectedResponse,
    mainRisk,
    activeEntities: [...workingMemory.activeEntities],
    constraints: [...workingMemory.constraints],
    uncertainty: calculateUncertainty(event, workingMemory)
  };
}

export function validateSituationModel(model) {
  const errors = [];
  if (model?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  for (const key of ['eventId', 'timestamp', 'userGoal', 'systemRole', 'currentStage', 'expectedResponse']) {
    if (!model?.[key]) errors.push(`missing_${key}`);
  }
  if (!Array.isArray(model?.activeEntities)) errors.push('invalid_activeEntities');
  if (!Array.isArray(model?.constraints)) errors.push('invalid_constraints');
  if (typeof model?.uncertainty !== 'number' || model.uncertainty < 0 || model.uncertainty > 1) errors.push('invalid_uncertainty');
  return { valid: errors.length === 0, errors };
}

function inferGoal(event) {
  if (event.entities.includes('backend')) return 'build_functional_digital_brain';
  if (event.entities.includes('data_pipeline')) return 'prepare_cognitive_data';
  return 'respond_to_current_turn';
}

function inferStage(event, memory) {
  if (memory.currentSubgoal) return memory.currentSubgoal;
  if (event.entities.includes('backend')) return 'backend_reconstruction';
  if (event.entities.includes('visual')) return 'visual_container';
  return 'active_dialogue';
}

function inferUserGoal(event, currentGoal) {
  if (event.intent === 'set_project_direction') return currentGoal;
  if (event.intent === 'request_action') return 'obtain_concrete_action';
  if (event.intent === 'correct_previous_behavior') return 'repair_system_behavior';
  if (event.intent === 'ask_information') return 'obtain_information';
  return 'continue_current_context';
}

function inferExpectedResponse(event) {
  if (event.intent === 'set_project_direction') return 'acknowledge_and_execute';
  if (event.intent === 'request_action') return 'perform_requested_action';
  if (event.intent === 'correct_previous_behavior') return 'acknowledge_and_repair';
  if (event.intent === 'ask_information') return 'direct_answer';
  return 'contextual_response';
}

function inferMainRisk(event, memory) {
  if (event.entities.includes('visual') && /не надо|лишн/i.test(event.text)) return 'continue_deprioritized_visual_work';
  if (event.entities.includes('backend') && memory.currentGoal === 'build_functional_digital_brain') return 'produce_architecture_without_executable_behavior';
  if (event.intent === 'correct_previous_behavior') return 'repeat_corrected_behavior';
  return 'misread_current_intent';
}

function calculateUncertainty(event, memory) {
  let uncertainty = 1 - event.confidence;
  if (!memory.currentGoal) uncertainty += 0.12;
  if (event.entities.length === 0) uncertainty += 0.08;
  return Math.max(0.02, Math.min(0.95, Number(uncertainty.toFixed(2))));
}

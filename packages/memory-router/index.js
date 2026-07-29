const LAYER_POLICIES = {
  project: ['working_memory', 'temporal_state', 'recent_decisions'],
  correction: ['working_memory', 'feedback', 'recent_events'],
  personal_fact: ['semantic_memory', 'temporal_state'],
  relationship: ['social_model', 'episodic_memory'],
  default: ['working_memory']
};

export function routeMemory(event, situation, workingMemory, options = {}) {
  if (!event || !situation || !workingMemory) throw new TypeError('event, situation and workingMemory are required');

  const memoryNeeded = decideMemoryNeed(event, situation, workingMemory);
  const category = classifyCategory(event, situation);
  const selectedLayers = memoryNeeded ? [...LAYER_POLICIES[category]] : [];
  const excludedLayers = inferExcludedLayers(event, selectedLayers);
  const budget = memoryNeeded ? Math.min(options.maxBudget ?? 5, selectedLayers.length + 2) : 0;

  return {
    schemaVersion: '1.0.0',
    eventId: event.id,
    memoryNeeded,
    category,
    selectedLayers,
    excludedLayers,
    budget,
    reason: explainDecision(memoryNeeded, category, event, workingMemory),
    privacyMode: inferPrivacyMode(event),
    uncertainty: Number(Math.min(0.95, situation.uncertainty + (memoryNeeded ? 0.03 : 0)).toFixed(2))
  };
}

export function validateMemoryDecision(decision) {
  const errors = [];
  if (decision?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  if (typeof decision?.memoryNeeded !== 'boolean') errors.push('invalid_memoryNeeded');
  if (!Array.isArray(decision?.selectedLayers)) errors.push('invalid_selectedLayers');
  if (!Array.isArray(decision?.excludedLayers)) errors.push('invalid_excludedLayers');
  if (!Number.isInteger(decision?.budget) || decision.budget < 0) errors.push('invalid_budget');
  if (!decision?.reason) errors.push('missing_reason');
  return { valid: errors.length === 0, errors };
}

function decideMemoryNeed(event, situation, memory) {
  if (event.intent === 'correct_previous_behavior') return true;
  if (event.intent === 'set_project_direction') return true;
  if (event.entities.some((entity) => ['Djbrain', 'Codex', 'data_pipeline', 'backend'].includes(entity))) return true;
  if (memory.currentGoal && situation.userGoal !== 'continue_current_context') return true;
  if (event.speechAct === 'question' && event.entities.length === 0 && event.text.length < 80) return false;
  return false;
}

function classifyCategory(event, situation) {
  if (event.intent === 'correct_previous_behavior') return 'correction';
  if (event.entities.some((entity) => ['Djbrain', 'Codex', 'backend', 'data_pipeline', 'visual'].includes(entity))) return 'project';
  if (/отношен|друг|партн|собеседник/i.test(event.text)) return 'relationship';
  if (/я живу|я учусь|я работаю|мне нравится|я люблю/i.test(event.text)) return 'personal_fact';
  return situation.currentGoal === 'build_functional_digital_brain' ? 'project' : 'default';
}

function inferExcludedLayers(event, selectedLayers) {
  const candidates = ['health', 'relationships', 'identity_core', 'cold_archive', 'raw_corpus'];
  if (/здоров|лекар|бипол/i.test(event.text)) return candidates.filter((layer) => !selectedLayers.includes(layer) && layer !== 'health');
  if (/отношен|партн|друг/i.test(event.text)) return candidates.filter((layer) => !selectedLayers.includes(layer) && layer !== 'relationships');
  return candidates.filter((layer) => !selectedLayers.includes(layer));
}

function inferPrivacyMode(event) {
  if (/здоров|лекар|отношен|адрес|телефон|паспорт/i.test(event.text)) return 'sensitive';
  return 'standard';
}

function explainDecision(memoryNeeded, category, event, memory) {
  if (!memoryNeeded) return 'Current turn can be answered from the message and active context without long-term retrieval.';
  if (event.intent === 'correct_previous_behavior') return 'Correction requires recent interaction history and feedback memory.';
  if (category === 'project') return 'Project continuity requires active goal, temporal state, and recent decisions.';
  if (memory.currentGoal) return 'An active goal exists and should constrain retrieval.';
  return 'Relevant prior context may materially affect the response.';
}

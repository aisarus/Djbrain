const LAYER_POLICIES = {
  project: ['working_memory', 'temporal_state', 'semantic_memory', 'episodic_memory', 'procedural_memory'],
  correction: ['working_memory', 'episodic_memory', 'feedback', 'procedural_memory'],
  feedback: ['working_memory', 'episodic_memory', 'feedback', 'procedural_memory'],
  personal_fact: ['semantic_memory', 'temporal_state', 'episodic_memory'],
  relationship: ['relationship_model', 'episodic_memory', 'semantic_memory'],
  default: ['working_memory']
};

export function routeMemory(event, situation, workingMemory, options = {}) {
  if (!event || !situation || !workingMemory) throw new TypeError('event, situation and workingMemory are required');

  const memoryNeeded = decideMemoryNeed(event, situation, workingMemory);
  const category = classifyCategory(event, situation);
  const selectedLayers = memoryNeeded ? [...LAYER_POLICIES[category]] : [];
  const excludedLayers = inferExcludedLayers(event, selectedLayers);
  const budget = memoryNeeded ? Math.min(options.maxBudget ?? 8, Math.max(3, selectedLayers.length + 1)) : 0;

  return {
    schemaVersion: '1.1.0',
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
  if (!['1.0.0','1.1.0'].includes(decision?.schemaVersion)) errors.push('invalid_schema_version');
  if (typeof decision?.memoryNeeded !== 'boolean') errors.push('invalid_memoryNeeded');
  if (!Array.isArray(decision?.selectedLayers)) errors.push('invalid_selectedLayers');
  if (!Array.isArray(decision?.excludedLayers)) errors.push('invalid_excludedLayers');
  if (!Number.isInteger(decision?.budget) || decision.budget < 0) errors.push('invalid_budget');
  if (!decision?.reason) errors.push('missing_reason');
  return { valid: errors.length === 0, errors };
}

function decideMemoryNeed(event, situation, memory) {
  if (['correct_previous_behavior','set_project_direction','evaluate_previous_output'].includes(event.intent)) return true;
  if (event.entities.some((entity) => ['Djbrain', 'Codex', 'data_pipeline', 'backend', 'identity_core', 'working_memory', 'episodic_memory', 'memory_router'].includes(entity))) return true;
  if (classifyCategory(event, situation) === 'relationship') return true;
  if (memory.currentGoal && situation.userGoal !== 'continue_current_context') return true;
  if (event.speechAct === 'question' && event.entities.length === 0 && event.text.length < 120) return false;
  return false;
}

function classifyCategory(event, situation) {
  if (event.intent === 'correct_previous_behavior') return 'correction';
  if (event.intent === 'evaluate_previous_output') return 'feedback';
  if (event.entities.some((entity) => ['Djbrain', 'Codex', 'backend', 'data_pipeline', 'visual', 'identity_core', 'working_memory', 'episodic_memory', 'memory_router'].includes(entity))) return 'project';
  if (/отношен|друг|партн|собеседник|коллег|семь|муж|жен|мама|папа/i.test(event.text)) return 'relationship';
  if (/я живу|я учусь|я работаю|мне нравится|я люблю|мой адрес|моё имя|мое имя/i.test(event.text)) return 'personal_fact';
  return situation.currentGoal === 'build_functional_digital_brain' ? 'project' : 'default';
}

function inferExcludedLayers(event, selectedLayers) {
  const candidates = ['health', 'relationship_model', 'identity_core', 'cold_archive', 'raw_corpus'];
  if (/здоров|лекар|бипол/i.test(event.text)) return candidates.filter((layer) => !selectedLayers.includes(layer) && layer !== 'health');
  if (/отношен|партн|друг|коллег/i.test(event.text)) return candidates.filter((layer) => !selectedLayers.includes(layer) && layer !== 'relationship_model');
  return candidates.filter((layer) => !selectedLayers.includes(layer));
}

function inferPrivacyMode(event) {
  if (/здоров|лекар|отношен|адрес|телефон|паспорт|парол/i.test(event.text)) return 'sensitive';
  return 'standard';
}

function explainDecision(memoryNeeded, category, event, memory) {
  if (!memoryNeeded) return 'Current turn can be answered from the message and active context without long-term retrieval.';
  if (event.intent === 'correct_previous_behavior') return 'Correction requires recent interaction history, feedback and applicable repair procedures.';
  if (event.intent === 'evaluate_previous_output') return 'Feedback requires the previous interaction and learning history.';
  if (category === 'relationship') return 'Relationship-sensitive requests require explicitly scoped social context.';
  if (category === 'project') return 'Project continuity requires active goal, temporal state, semantic facts, episodes and procedures.';
  if (memory.currentGoal) return 'An active goal exists and should constrain retrieval.';
  return 'Relevant prior context may materially affect the response.';
}

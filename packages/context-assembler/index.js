export function assembleGenerationContext({ event, situation, workingMemory, strategy, memories = [], maxItems = 8, maxChars = 6000 } = {}) {
  if (!event || !situation || !workingMemory || !strategy) throw new TypeError('event, situation, workingMemory and strategy are required');

  const ranked = [...memories]
    .map((memory) => ({ memory, score: scoreMemory(memory, event, situation) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  const selected = [];
  let usedChars = 0;
  for (const { memory, score } of ranked) {
    const compact = compactMemory(memory, score);
    const size = JSON.stringify(compact).length;
    if (usedChars + size > maxChars) continue;
    selected.push(compact);
    usedChars += size;
  }

  return {
    schemaVersion: '1.0.0',
    event: {
      id: event.id,
      text: event.text,
      intent: event.intent,
      speechAct: event.speechAct,
      tone: event.tone,
      entities: event.entities
    },
    situation: {
      userGoal: situation.userGoal,
      currentGoal: situation.currentGoal,
      currentStage: situation.currentStage,
      expectedResponse: situation.expectedResponse,
      mainRisk: situation.mainRisk,
      uncertainty: situation.uncertainty
    },
    workingMemory: {
      currentGoal: workingMemory.currentGoal,
      currentSubgoal: workingMemory.currentSubgoal,
      activeEntities: workingMemory.activeEntities,
      constraints: workingMemory.constraints,
      recentDecisions: workingMemory.recentDecisions
    },
    strategy,
    memories: selected,
    budget: { maxItems, maxChars, usedItems: selected.length, usedChars }
  };
}

export function validateGenerationContext(context) {
  const errors = [];
  if (context?.schemaVersion !== '1.0.0') errors.push('invalid_schema_version');
  for (const key of ['event','situation','workingMemory','strategy','budget']) if (!context?.[key]) errors.push(`missing_${key}`);
  if (!Array.isArray(context?.memories)) errors.push('invalid_memories');
  if (context?.budget?.usedItems > context?.budget?.maxItems) errors.push('item_budget_exceeded');
  if (context?.budget?.usedChars > context?.budget?.maxChars) errors.push('char_budget_exceeded');
  return { valid: errors.length === 0, errors };
}

function scoreMemory(memory, event, situation) {
  const entities = memory.entities ?? [];
  const entityOverlap = entities.filter((item) => event.entities.includes(item)).length;
  const importance = memory.importance ?? memory.confidence ?? 0.5;
  const currentBonus = memory.status === 'current' || memory.current === true ? 0.2 : 0;
  const goalBonus = JSON.stringify(memory).toLowerCase().includes(String(situation.currentGoal).toLowerCase()) ? 0.15 : 0;
  return entityOverlap * 0.35 + importance * 0.3 + currentBonus + goalBonus;
}

function compactMemory(memory, score) {
  const type = memory.layer ?? ('predicate' in memory ? 'semantic_memory' : 'sourceEventIds' in memory ? 'episodic_memory' : 'memory');
  return {
    id: memory.id,
    type,
    score: Number(score.toFixed(3)),
    summary: memory.summary ?? null,
    claim: memory.predicate ? `${memory.subject}:${memory.predicate}=${String(memory.value)}` : null,
    value: memory.stateType ? memory.value : undefined,
    validFrom: memory.validFrom ?? memory.timeStart ?? null,
    validTo: memory.validTo ?? memory.timeEnd ?? null,
    confidence: memory.confidence ?? null,
    evidenceIds: memory.supportingEpisodeIds ?? memory.sourceEventIds ?? []
  };
}

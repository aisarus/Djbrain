export function critiqueResponse({ event, strategy, context, generation } = {}) {
  if (!event || !strategy || !context || !generation) throw new TypeError('event, strategy, context and generation are required');

  const warnings = [];
  const text = generation.text ?? '';
  if (!text.trim()) warnings.push('empty_response');
  if (strategy.objectives.includes('perform_next_action') && !containsActionSignal(text)) warnings.push('missing_action_signal');
  if (strategy.avoid.includes('plan_only_response') && /\b(plan|roadmap|later|next step)\b/i.test(text) && !containsActionSignal(text)) warnings.push('plan_only_response');
  if (context.memories.length === 0 && /remember|memory|previously|as you said/i.test(text)) warnings.push('unsupported_memory_reference');
  if (context.memories.some((memory) => memory.confidence != null && memory.confidence < 0.4) && /definitely|certainly|точно|безусловно/i.test(text)) warnings.push('overconfident_low_support_memory');
  if (text.length > 12000) warnings.push('response_too_long');
  if (event.intent === 'ask_information' && !/[.!?]$/.test(text.trim())) warnings.push('possibly_incomplete_answer');

  const blocking = warnings.filter((warning) => ['empty_response','unsupported_memory_reference','overconfident_low_support_memory'].includes(warning));
  return {
    schemaVersion: '1.0.0',
    status: blocking.length ? 'rejected' : warnings.length ? 'approved_with_warnings' : 'approved',
    warnings,
    blocking,
    repairRequired: blocking.length > 0,
    repairInstructions: blocking.map(toRepairInstruction),
    confidence: Number(Math.max(0.05, 1 - warnings.length * 0.12).toFixed(2))
  };
}

export function validateCriticReport(report) {
  const errors = [];
  if (!['approved','approved_with_warnings','rejected'].includes(report?.status)) errors.push('invalid_status');
  if (!Array.isArray(report?.warnings)) errors.push('invalid_warnings');
  if (!Array.isArray(report?.blocking)) errors.push('invalid_blocking');
  if (typeof report?.repairRequired !== 'boolean') errors.push('invalid_repair_required');
  return { valid: errors.length === 0, errors };
}

function containsActionSignal(text) {
  return /execut|implemented|created|updated|committed|running|делаю|сделано|добавил|исправил|запустил/i.test(text);
}

function toRepairInstruction(code) {
  const map = {
    empty_response: 'Generate a non-empty response that completes the selected strategy.',
    unsupported_memory_reference: 'Remove references to memories that were not selected in context.',
    overconfident_low_support_memory: 'Hedge or omit claims supported only by low-confidence memory.'
  };
  return map[code] ?? `Repair issue: ${code}`;
}

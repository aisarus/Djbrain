export class LanguageProvider {
  async generate(_context) {
    throw new Error('LanguageProvider.generate must be implemented');
  }
}

export class DeterministicLanguageProvider extends LanguageProvider {
  async generate(context) {
    const { event, strategy, memories } = context;
    const memoryClause = memories.length
      ? `I used ${memories.length} relevant memory item${memories.length === 1 ? '' : 's'}.`
      : 'No long-term memory was required.';
    const text = render(strategy.move, event.text, memoryClause);
    return {
      provider: 'deterministic-test-provider',
      model: 'none',
      text,
      usage: { inputChars: JSON.stringify(context).length, outputChars: text.length },
      raw: null
    };
  }

  async repair({ context, generation, critic }) {
    const suffix = critic?.reasons?.length
      ? ` Repair constraints: ${critic.reasons.join(', ')}.`
      : ' Repair applied.';
    const text = `${generation.text}${suffix}`;
    return {
      provider: 'deterministic-test-provider',
      model: 'none',
      text,
      usage: { inputChars: JSON.stringify(context).length, outputChars: text.length },
      raw: null
    };
  }
}

export function validateGenerationResult(result) {
  const errors = [];
  if (!result?.provider) errors.push('missing_provider');
  if (typeof result?.text !== 'string' || result.text.length === 0) errors.push('missing_text');
  if (!result?.usage || typeof result.usage.inputChars !== 'number') errors.push('invalid_usage');
  if (result?.usage && typeof result.usage.outputChars !== 'number') errors.push('invalid_output_usage');
  return { valid: errors.length === 0, errors };
}

function render(move, input, memoryClause) {
  const prefixes = {
    acknowledge_repair_and_act: 'Correction accepted. I will repair the behavior and continue.',
    integrate_feedback: 'Feedback registered and converted into a reversible update proposal.',
    confirm_direction_and_execute: 'Direction preserved. Execution continues.',
    perform_action: 'Executing the requested action.',
    direct_answer: 'Answering directly.',
    advance_active_goal: 'Continuing the active goal.',
    contextual_response: 'Responding in the current context.'
  };
  return `${prefixes[move] ?? prefixes.contextual_response} ${memoryClause} Input: ${input}`;
}

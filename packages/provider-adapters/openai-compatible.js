export function createOpenAICompatibleProvider(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = String(options.baseUrl ?? '').replace(/\/$/, '');
  const model = options.model;
  const apiKey = options.apiKey ?? null;
  const providerId = options.id ?? 'openai-compatible';
  if (!fetchImpl) throw new TypeError('fetch implementation is required');
  if (!baseUrl || !model) throw new TypeError('baseUrl and model are required');

  async function invoke(request, repair = null) {
    const messages = toMessages(request, repair, options.systemPrompt);
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? options.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? options.maxTokens ?? 800,
        response_format: request.responseFormat ?? options.responseFormat ?? undefined
      })
    });

    if (!response.ok) {
      const body = await safeText(response);
      throw new Error(`provider_http_${response.status}:${body.slice(0, 300)}`);
    }
    const payload = await response.json();
    const choice = payload.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('provider_invalid_response');
    const serializedInput = JSON.stringify(messages);
    return {
      provider: providerId,
      text: text.trim(),
      model: payload.model ?? model,
      finishReason: choice.finish_reason ?? null,
      usage: {
        inputChars: serializedInput.length,
        outputChars: text.length,
        promptTokens: payload.usage?.prompt_tokens ?? null,
        completionTokens: payload.usage?.completion_tokens ?? null,
        totalTokens: payload.usage?.total_tokens ?? null
      },
      rawId: payload.id ?? null,
      raw: options.includeRaw === true ? payload : null
    };
  }

  return {
    id: providerId,
    generate: (request) => invoke(request),
    repair: ({ context, generation, critic }) => invoke(context, { generation, critic })
  };
}

function toMessages(request, repair = null, customSystemPrompt = null) {
  if (Array.isArray(request.messages)) {
    return [
      ...(request.system ? [{ role: 'system', content: request.system }] : []),
      ...request.messages
    ];
  }

  const system = customSystemPrompt ?? [
    'You are the language layer of a cognitive runtime.',
    'Follow the supplied response strategy.',
    'Use only memory items present in the context.',
    'Do not reveal provenance or private metadata unless explicitly included.',
    'When uncertainty is high, state uncertainty instead of inventing facts.'
  ].join(' ');
  const payload = request.prompt
    ? request.prompt
    : JSON.stringify({
        event: request.event,
        situation: request.situation,
        workingMemory: request.workingMemory,
        strategy: request.strategy,
        memories: request.memories,
        budget: request.budget
      });
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: payload }
  ];
  if (repair) {
    messages.push({
      role: 'user',
      content: JSON.stringify({
        instruction: 'Repair the previous draft using the critic report. Return only the repaired answer.',
        previousDraft: repair.generation?.text,
        critic: repair.critic
      })
    });
  }
  return messages;
}

async function safeText(response) {
  try { return await response.text(); } catch { return ''; }
}

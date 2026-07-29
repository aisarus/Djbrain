export function createOpenAICompatibleProvider(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const baseUrl = String(options.baseUrl ?? '').replace(/\/$/, '');
  const model = options.model;
  const apiKey = options.apiKey ?? null;
  if (!fetchImpl) throw new TypeError('fetch implementation is required');
  if (!baseUrl || !model) throw new TypeError('baseUrl and model are required');

  return {
    id: options.id ?? 'openai-compatible',
    async generate(request) {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          messages: toMessages(request),
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 800,
          response_format: request.responseFormat ?? undefined
        })
      });

      if (!response.ok) {
        const body = await safeText(response);
        throw new Error(`provider_http_${response.status}:${body.slice(0, 300)}`);
      }
      const payload = await response.json();
      const choice = payload.choices?.[0];
      const text = choice?.message?.content;
      if (typeof text !== 'string') throw new Error('provider_invalid_response');
      return {
        text,
        model: payload.model ?? model,
        finishReason: choice.finish_reason ?? null,
        usage: payload.usage ?? null,
        rawId: payload.id ?? null
      };
    }
  };
}

function toMessages(request) {
  const messages = [];
  if (request.system) messages.push({ role: 'system', content: request.system });
  if (Array.isArray(request.messages)) messages.push(...request.messages);
  else if (request.prompt) messages.push({ role: 'user', content: request.prompt });
  return messages;
}

async function safeText(response) {
  try { return await response.text(); } catch { return ''; }
}
